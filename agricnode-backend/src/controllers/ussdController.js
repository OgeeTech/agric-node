const User = require("../models/User");
const Listing = require("../models/Listing");
const Product = require("../models/Product");
const Order = require("../models/Order");
const { parseUssdText } = require("../utils/ussdHelper");
const { verifyTransaction } = require("../utils/paystack");

const AREA_COUNCILS = {
  1: "Bwari",
  2: "Gwagwalada",
  3: "Kuje",
  4: "Kwali",
  5: "Abaji",
  6: "AMAC",
};

const handleUssd = async (req, res) => {
  try {
    const { phoneNumber, text } = req.body;
    const { step, inputs } = parseUssdText(text);
    let response = "";

    let user = await User.findOne({ phoneNumber });

    if (!user || !user.isRegistered) {
      if (step === 0) {
        response = `CON Welcome to AgriNode FCT.\nYou must register before listing crops.\n1. Register as a Farmer`;
      } else if (step === 1 && inputs[0] === "1") {
        response = `CON Enter your Full Name:`;
      } else if (step === 2 && inputs[0] === "1") {
        response = `CON Select your FCT Area Council:\n1. Bwari\n2. Gwagwalada\n3. Kuje\n4. Kwali\n5. Abaji\n6. AMAC`;
      } else if (step === 3 && inputs[0] === "1") {
        if (!AREA_COUNCILS[inputs[2]]) {
          response = `END Invalid Area Council selected. Please dial again.`;
        } else {
          response = `CON Enter your 11-digit NIN (National ID Number):`;
        }
      } else if (step === 4 && inputs[0] === "1") {
        const fullName = inputs[1].trim();
        const areaCouncil = AREA_COUNCILS[inputs[2]];
        const nin = inputs[3].trim();

        // Validate 11-digit NIN
        if (!/^\d{11}$/.test(nin)) {
          response = `END Registration Failed: NIN must be an exact 11-digit number.`;
        } else {
          // Check if NIN is already used by another phone number
          const existingNin = await User.findOne({
            nin,
            phoneNumber: { $ne: phoneNumber },
          });
          if (existingNin) {
            response = `END Registration Failed: This NIN is already linked to another farmer.`;
          } else {
            user = await User.findOneAndUpdate(
              { phoneNumber },
              {
                phoneNumber,
                name: fullName,
                areaCouncil,
                nin,
                role: "farmer",
                isRegistered: true,
              },
              { upsert: true, new: true },
            );

            response = `END Registration Complete!\nWelcome ${user.name} (${user.areaCouncil}).\nNIN Verified: ${nin.slice(0, 3)}*****${nin.slice(-3)}.\nDial *384*100# again to list crops.`;
          }
        }
      } else {
        response = `END Invalid selection. Please dial *384*100# to register.`;
      }

      res.set("Content-Type", "text/plain");
      return res.send(response);
    }

    // Fetch live catalog from database (Admin-managed products)
    const catalog = await Product.find().sort({ ussdCode: 1 });

    if (step === 0) {
      response = `CON Welcome, ${user.name} (${user.areaCouncil})\n1. List Crop for Sale\n2. Check Escrow & Wallet Balance\n3. My Active Listings`;
    }
    // Option 1: List a Crop -> Dynamically generated from Admin Catalog
    else if (step === 1 && inputs[0] === "1") {
      if (catalog.length === 0) {
        response = `END The market is currently closed. No crops available to list.`;
      } else {
        let menu = "CON Select Crop to Sell:\n";
        catalog.forEach((p) => {
          menu += `${p.ussdCode}. ${p.name}\n`;
        });
        response = menu;
      }
    } else if (step === 2 && inputs[0] === "1") {
      const selectedProduct = catalog.find(
        (p) => String(p.ussdCode) === String(inputs[1]).trim(),
      );
      if (!selectedProduct) {
        response = `END Invalid crop selection. Please try again.`;
      } else {
        response = `CON Enter quantity of ${selectedProduct.name} (in kg):`;
      }
    } else if (step === 3 && inputs[0] === "1") {
      const qty = Number(inputs[2]);
      if (isNaN(qty) || qty <= 0) {
        response = `END Invalid quantity entered.`;
      } else {
        const selectedProduct = catalog.find(
          (p) => String(p.ussdCode) === String(inputs[1]).trim(),
        );
        response = `CON Enter total price in NGN for ${qty}kg of ${selectedProduct.name}:`;
      }
    } else if (step === 4 && inputs[0] === "1") {
      const selectedProduct = catalog.find(
        (p) => String(p.ussdCode) === String(inputs[1]).trim(),
      );
      const quantity = Number(inputs[2]);
      const price = Number(inputs[3]);

      if (isNaN(price) || price <= 0) {
        response = `END Invalid price entered.`;
      } else {
        // Auto-attach the Admin's Image & Description
        await Listing.create({
          farmerId: user._id,
          cropType: selectedProduct.name,
          quantity,
          price,
          areaCouncil: user.areaCouncil,
          imageUrl: selectedProduct.imageUrl,
          description: selectedProduct.baseDescription,
          status: "available",
        });

        response = `END Listed Successfully!\n${quantity}kg of ${selectedProduct.name} is now live with official images for NGN ${price.toLocaleString()}.`;
      }
    }
    // Option 2: Check Wallet & Escrow Balances (Dynamically Calculated from Orders)
    else if (step === 1 && inputs[0] === "2") {
      const farmerListings = await Listing.find({ farmerId: user._id }).select(
        "_id",
      );
      const listingIds = farmerListings.map((l) => l._id);

      const farmerOrders = await Order.find({
        listingId: { $in: listingIds },
      });

      let walletBalance = 0;
      let escrowBalance = 0;

      for (const order of farmerOrders) {
        // Reconcile any order still marked pending_payment if buyer already paid on Paystack
        if (
          order.paymentStatus === "pending_payment" &&
          order.paymentReference
        ) {
          try {
            const paystackTx = await verifyTransaction(order.paymentReference);
            const txStatus = paystackTx?.data?.status || paystackTx?.status;
            if (txStatus === "success") {
              order.paymentStatus = "held_in_escrow";
              order.deliveryStatus = "pending_dispatch";
              await order.save();
              await Listing.findByIdAndUpdate(order.listingId, {
                status: "in_escrow",
              });
            }
          } catch {
            // Ignore unpaid checkouts
          }
        }

        const payout =
          order.farmerPayout || Math.round((order.amountPaid || 0) * 0.98);

        if (order.paymentStatus === "held_in_escrow") {
          escrowBalance += payout;
        } else if (order.paymentStatus === "released") {
          walletBalance += payout;
        }
      }

      // Sync calculated balances to User document
      user.walletBalance = walletBalance;
      user.escrowBalance = escrowBalance;
      await user.save();

      response = `END Account Summary (${user.name}):\nAvailable Wallet: NGN ${walletBalance.toLocaleString()}\nLocked in Escrow: NGN ${escrowBalance.toLocaleString()}\nArea Council: ${user.areaCouncil}`;
    }
    // Option 3: Check Active Listings
    else if (step === 1 && inputs[0] === "3") {
      const activeListings = await Listing.find({
        farmerId: user._id,
        status: { $in: ["available", "pending_escrow", "in_escrow"] },
      }).limit(3);

      if (activeListings.length === 0) {
        response = `END You have no active crop listings.`;
      } else {
        const listText = activeListings
          .map(
            (l, idx) =>
              `${idx + 1}. ${l.quantity}kg ${l.cropType} - NGN ${l.price.toLocaleString()} (${l.status.replace("_", " ")})`,
          )
          .join("\n");
        response = `END Your Active Crops:\n${listText}`;
      }
    } else {
      response = `END Invalid input. Please try again.`;
    }

    res.set("Content-Type", "text/plain");
    return res.send(response);
  } catch (error) {
    console.error(`[USSD Error]: ${error.message}`);
    res.set("Content-Type", "text/plain");
    return res.send("END A system error occurred. Please try again.");
  }
};

module.exports = { handleUssd };

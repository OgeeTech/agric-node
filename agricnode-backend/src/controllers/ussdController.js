const User = require("../models/User");
const Listing = require("../models/Listing");
const { parseUssdText } = require("../utils/ussdHelper");

const AREA_COUNCILS = {
  1: "Bwari",
  2: "Gwagwalada",
  3: "Kuje",
  4: "Kwali",
  5: "Abaji",
  6: "AMAC",
};

const CROPS = {
  1: "Maize",
  2: "Tomatoes",
  3: "Rice",
  4: "Yam",
  5: "Cassava",
};

const handleUssd = async (req, res) => {
  try {
    const { phoneNumber, text } = req.body;
    const { step, inputs } = parseUssdText(text);
    let response = "";

    let user = await User.findOne({ phoneNumber });

    if (!user || !user.isRegistered) {
      if (step === 0) {
        response = `CON Welcome to AgriNode FCT.
You must register before listing crops.
1. Register as a Farmer`;
      } else if (step === 1 && inputs[0] === "1") {
        response = `CON Enter your Full Name:`;
      } else if (step === 2 && inputs[0] === "1") {
        response = `CON Select your FCT Area Council:
1. Bwari
2. Gwagwalada
3. Kuje
4. Kwali
5. Abaji
6. AMAC`;
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

            response = `END Registration Complete!
Welcome ${user.name} (${user.areaCouncil}).
NIN Verified: ${nin.slice(0, 3)}*****${nin.slice(-3)}.
Dial *384*100# again to list crops.`;
          }
        }
      } else {
        response = `END Invalid selection. Please dial *384*100# to register.`;
      }

      res.set("Content-Type", "text/plain");
      return res.send(response);
    }

    if (step === 0) {
      response = `CON Welcome, ${user.name} (${user.areaCouncil})
1. List Crop for Sale
2. Check Escrow & Wallet Balance
3. My Active Listings`;
    }
    // Option 1: List a Crop
    else if (step === 1 && inputs[0] === "1") {
      response = `CON Select Crop to Sell:
1. Maize
2. Tomatoes
3. Rice
4. Yam
5. Cassava`;
    } else if (step === 2 && inputs[0] === "1") {
      if (!CROPS[inputs[1]]) {
        response = `END Invalid crop selection. Please try again.`;
      } else {
        response = `CON Enter quantity of ${CROPS[inputs[1]]} (in kg):`;
      }
    } else if (step === 3 && inputs[0] === "1") {
      const qty = Number(inputs[2]);
      if (isNaN(qty) || qty <= 0) {
        response = `END Invalid quantity entered.`;
      } else {
        response = `CON Enter total price in NGN for ${qty}kg of ${CROPS[inputs[1]]}:`;
      }
    } else if (step === 4 && inputs[0] === "1") {
      const cropType = CROPS[inputs[1]];
      const quantity = Number(inputs[2]);
      const price = Number(inputs[3]);

      if (isNaN(price) || price <= 0) {
        response = `END Invalid price entered.`;
      } else {
        await Listing.create({
          farmerId: user._id,
          cropType,
          quantity,
          price,
          areaCouncil: user.areaCouncil,
        });

        response = `END Listed Successfully!
${quantity}kg of ${cropType} from ${user.areaCouncil} is live for NGN ${price.toLocaleString()}.`;
      }
    }
    // Option 2: Check Wallet & Escrow Balances
    else if (step === 1 && inputs[0] === "2") {
      response = `END Account Summary (${user.name}):
Available Wallet: NGN ${user.walletBalance.toLocaleString()}
Locked in Escrow: NGN ${user.escrowBalance.toLocaleString()}
Area Council: ${user.areaCouncil}`;
    }
    // Option 3: Check Active Listings
    else if (step === 1 && inputs[0] === "3") {
      const activeListings = await Listing.find({
        farmerId: user._id,
        status: { $in: ["available", "pending_escrow"] },
      }).limit(3);

      if (activeListings.length === 0) {
        response = `END You have no active crop listings.`;
      } else {
        const listText = activeListings
          .map(
            (l, idx) =>
              `${idx + 1}. ${l.quantity}kg ${l.cropType} - NGN ${l.price} (${l.status})`,
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

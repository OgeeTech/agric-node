const User = require("../models/User");
const Listing = require("../models/Listing");
const { parseUssdText } = require("../utils/ussdHelper");

const handleUssd = async (req, res) => {
  try {
    // Africa's Talking sends data as application/x-www-form-urlencoded
    const { sessionId, serviceCode, phoneNumber, text } = req.body;
    const { step, inputs } = parseUssdText(text);

    let response = "";

    // 1. Silent Onboarding: Create the farmer if they don't exist
    let user = await User.findOne({ phoneNumber });
    if (!user) {
      user = await User.create({
        phoneNumber,
        role: "farmer",
        location: "Bwari, FCT", // Hardcoded for the MVP scope
      });
    }

    // 2. USSD State Machine
    if (step === 0) {
      // Empty text string means it is the initial dial
      response = `CON Welcome to AgriNode Marketplace
      1. List a Crop for Sale
      2. Check Escrow Balance`;
    } else if (step === 1 && inputs[0] === "1") {
      response = `CON Select Crop Type:
      1. Maize
      2. Tomatoes
      3. Rice`;
    } else if (step === 1 && inputs[0] === "2") {
      response = `END Your current escrow balance is NGN ${user.walletBalance}.`;
    } else if (step === 2 && inputs[0] === "1") {
      response = `CON Enter quantity (in kg):`;
    } else if (step === 3 && inputs[0] === "1") {
      response = `CON Enter the total price (in NGN) for the full quantity:`;
    } else if (step === 4 && inputs[0] === "1") {
      // Data extraction from the array: ['1', '1', '50', '20000']
      const cropMap = { 1: "Maize", 2: "Tomatoes", 3: "Rice" };
      const cropType = cropMap[inputs[1]] || "Unknown";
      const quantity = Number(inputs[2]);
      const price = Number(inputs[3]);

      // Save the listing to MongoDB
      await Listing.create({
        farmerId: user._id,
        cropType,
        quantity,
        price,
        location: user.location,
      });

      response = `END Success! Your ${quantity}kg of ${cropType} is listed for NGN ${price}. Buyers will contact you soon.`;
    } else {
      response = "END Invalid input. Please try again.";
    }

    // Africa's Talking strictly requires the Content-Type to be text/plain
    res.set("Content-Type", "text/plain");
    res.send(response);
  } catch (error) {
    console.error(`[USSD Error]: ${error.message}`);
    res.set("Content-Type", "text/plain");
    res.send("END A system error occurred. Please try again later.");
  }
};

module.exports = { handleUssd };

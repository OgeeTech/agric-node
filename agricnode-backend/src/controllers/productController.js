const Product = require("../models/Product");

const getCatalog = async (req, res) => {
  try {
    const products = await Product.find().sort({ ussdCode: 1 });
    res.status(200).json({ status: "success", data: products });
  } catch (error) {
    res
      .status(500)
      .json({ status: "error", message: "Failed to fetch catalog" });
  }
};

const addProduct = async (req, res) => {
  try {
    const { name, ussdCode, imageUrl, baseDescription } = req.body;
    const product = await Product.create({
      name,
      ussdCode,
      imageUrl,
      baseDescription,
    });
    res.status(201).json({ status: "success", data: product });
  } catch (error) {
    res
      .status(500)
      .json({
        status: "error",
        message: "Failed to add product. Check if USSD code is duplicate.",
      });
  }
};

const deleteProduct = async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.status(200).json({ status: "success", message: "Product deleted" });
  } catch (error) {
    res
      .status(500)
      .json({ status: "error", message: "Failed to delete product" });
  }
};

module.exports = { getCatalog, addProduct, deleteProduct };

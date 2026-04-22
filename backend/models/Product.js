const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    p_id: { type: Number, unique: true, required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    brand: { type: String, default: "" },
    colour: { type: String, default: "" },
    price: { type: Number, required: true },
    ratingCount: { type: Number, default: 0 },
    avg_rating: { type: Number, default: 0 },
    p_attributes: { type: mongoose.Schema.Types.Mixed, default: {} },
    image_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    img: { type: String, default: "" },
    image: { type: String, default: "" },
    category: { type: String, default: "" },
    outfitSlot: {
      type: String,
      enum: ["top", "bottom", "dress", "accessory", "outerwear"],
      default: "top",
    },
    subCategory: { type: String, default: "Top" },
    feature_index: { type: Number, default: null },
    stock: { type: Number, default: 50 },
    lowStockThreshold: { type: Number, default: 10 },
    aiIndexed: { type: Boolean, default: false },
    aiIndexedAt: { type: Date, default: null },
    aiIndexError: { type: String, default: "" },
  },
  {
    collection: "products",
    timestamps: false,
  }
);

productSchema.virtual("isLowStock").get(function () {
  return this.stock <= this.lowStockThreshold;
});

productSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Product", productSchema);

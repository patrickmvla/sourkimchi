import mongoose from "mongoose";

export const MenuSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Types.ObjectId,
    required: true,
    default: () => new mongoose.Types.ObjectId(),
  },
  name: { type: String, required: true },
  price: { type: Number, required: true },
});

export const MenuModel = mongoose.model("Menu", MenuSchema);

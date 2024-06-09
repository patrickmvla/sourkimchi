import mongoose from "mongoose";
import { MenuSchema } from "./menu.js";

const RestaurantSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "UserModel" },
  name: { type: String, required: true },
  deliveryPrice: { type: Number, required: true },
  estimatedDeliveryTime: { type: Number, required: true },
  cuisines: [{ type: String, required: true }],
  menu: [MenuSchema],
  imageUrl: { type: String, required: true },
  lastUpdated: { type: Date, required: true },
});

export const RestaurantModel = mongoose.model("Restaurant", RestaurantSchema);

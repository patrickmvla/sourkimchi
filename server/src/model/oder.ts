import mongoose from "mongoose";

export const OderSchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "RestaurantModel" },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "UserModel" },
  deliveryDetails: {
    username: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String, required: true },
  },
  cart: {
    menuItemId: { type: String, required: true },
    quantity: { type: Number, required: true },
    name: { type: String, required: true },
  },
  totalAmount: Number,
  status: {
    type: String,
    enum: ["placed", "paid", "inProgress", "outOfDelivery", "delivered"],
  },
  createdAt: { type: Date, default: Date.now },
});

export const OderModel = mongoose.model("Oder", OderSchema);

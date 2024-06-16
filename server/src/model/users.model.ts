import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please provide name"],
    lowercase: true,
    minLength: [3, "Name can't be smaller than 3 characters"],
    maxLength: [15, "Name can't be greater than 15 characters"],
  },
  email: { type: String, required: true },
  addressLine1: { type: String },
  city: {
    type: String,
  },
  country: { type: String },
});

export const UserModel = mongoose.model("User", UserSchema);

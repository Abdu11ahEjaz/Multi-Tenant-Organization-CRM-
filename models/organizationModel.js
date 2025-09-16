import mongoose from "mongoose";

const orgModel = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    logo: {
      type: String,
      required: true,
    },
    subscriptionPlan: {
      type: String,
      enum: ["Free", "Pro", "Enterprise"],
      default: "FREE",
    },
    limits: {
      clients: {
        type: Number,
        default: 10,
      },
      users: {
        type: Number,
        default: 2,
      },
      storage: {
        type: Number,
        default: 50,
      },
      storageUsed: { 
        type: Number, 
        default: 0 
    },
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Organization", orgModel);

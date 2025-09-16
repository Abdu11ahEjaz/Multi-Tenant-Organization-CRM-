import mongoose from "mongoose";

const clientModel = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
    },
    company: {
      type: String,
    },
    tags: {
      type: String,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

clientModel.index({ organizationId: 1, email: 1 }, { unique: true });
clientModel.index({ organizationId: 1, name: 'text', company: 'text', tags: 'text' });

export default mongoose.model('Client',clientModel);

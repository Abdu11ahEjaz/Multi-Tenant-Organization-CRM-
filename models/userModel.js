import mongoose from "mongoose";

const userModel = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: function(){return this.role !== 'SuperAdmin'},
      index: true,
    },
    name:{
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['SuperAdmin','Admin', 'Staff', 'Owner'],
      default: 'Staff',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    assignedClientsIds: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
    },
  },
  { timestamps: true }
);

userModel.index({ organizationId: 1, email: 1 }, { unique: true });


userModel.pre("save", function (next) {
  if (this.email) {
    let email = this.email.trim().toLowerCase();

    const [localPart, domain] = email.split("@");
    if (domain === "gmail.com" || domain === "googlemail.com") {
      const normalizedLocal = localPart.split("+")[0].replace(/\./g, "");
      email = `${normalizedLocal}@gmail.com`;
    }

    this.email = email;
  }
  next();
});

export default mongoose.model("User", userModel);

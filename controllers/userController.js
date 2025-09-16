import userModel from "../models/userModel.js";
import organizationModel from "../models/organizationModel.js";
import bcrypt from "bcrypt";
import mongoose from "mongoose";

const createUser = async (req, res) => {
  const { name, email, password, role } = req.body;

  if (role === "Owner") {
    return res.status(403).json({
      message:
        "Owner creation is restricted. Only SuperAdmin can create Owner via dedicated route.",
    });
  }

  try {
    const orgId = req.user?.organizationId || req.body?.organizationId;
    console.log("Resolved orgId:", orgId);
    if (!orgId) {
      return res.status(404).json({ message: "Organization ID not found" });
    }

    // Validate orgId format
    if (!mongoose.Types.ObjectId.isValid(orgId)) {
      console.log("Invalid ObjectId format:", orgId);
      return res
        .status(400)
        .json({ message: "Invalid organization ID format" });
    }

    const org = await organizationModel.findById(orgId);
    if (!org) {
      console.log("Organization not found for ID:", orgId);
      return res.status(404).json({ message: "Organization not found" });
    }

    const existing = await userModel.findOne({ email, organizationId: orgId });
    if (existing) {
      return res
        .status(400)
        .json({ message: "User already exists in your organization" });
    }

    // Check user limit
    // Check user limit (skip if unlimited)
    if (org.limits.users !== -1) {
      const userCount = await userModel.countDocuments({
        organizationId: orgId,
      });
      if (userCount >= org.limits.users) {
        return res
          .status(403)
          .json({ message: "User limit reached for your plan" });
      }
    }

    console.log("Creating user in org:", orgId);

    const hashed = await bcrypt.hash(password, 10);
    const newUser = new userModel({
      name,
      email,
      password: hashed,
      role,
      organizationId: orgId,
    });

    await newUser.save();

    res.status(201).json({
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    });
  } catch (error) {
    console.error("Create User error:", error);
    res.status(500).json({ message: error.message });
  }
};

const getUsers = async (req, res) => {
  try {
    const orgId = req.user?.organizationId || req.body.organizationId;
    if (!orgId) {
      return res
        .status(400)
        .json({ message: "Organization ID is missing or invalid" });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const total = await userModel.countDocuments({ organizationId: orgId });

    const users = await userModel
      .find({ organizationId: orgId, role: { $ne: "SuperAdmin" } })
      .select("-password")
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPages = Math.ceil(total / limit);

    res.json({
      total,
      page,
      limit,
      totalPages,
      data: users,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getUser = async (req, res) => {
  try {
    const orgId = req.user?.organizationId || req.body.organizationId;
    if (!orgId) {
      return res
        .status(400)
        .json({ message: "Organization ID is missing or invalid" });
    }
    const userId = req.params.id;

    const user = await userModel
      .findOne({
        _id: userId,
        organizationId: orgId,
        role: { $ne: "SuperAdmin" },
      })
      .select("-password")
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateUser = async (req, res) => {
  const { id } = req.params;
  try {
    if (!req.body) {
      return res.status(400).json({ message: "Missing request body" });
    }

    const { name, role, password, email } = req.body;
    const orgId = req.user.organizationId;

    const user = await userModel.findOne({ _id: id, organizationId: orgId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "Owner" && req.user.role !== "SuperAdmin") {
      return res
        .status(403)
        .json({ message: "Only SuperAdmin can update Owner" });
    }

    // Check email uniqueness if updating
    if (email && email.toLowerCase() !== user.email) {
      const normalizedEmail = email.trim().toLowerCase();
      const existing = await userModel.findOne({
        email: normalizedEmail,
        organizationId: orgId,
        _id: { $ne: id }, // exclude current user
      });
      if (existing) {
        return res
          .status(400)
          .json({ message: "Email already exists in this organization" });
      }
      user.email = normalizedEmail;
    }

    if (name) user.name = name;

    // Prevent accidental role escalation 
    if (role) {
      if (role === "SuperAdmin") {
        return res
          .status(403)
          .json({ message: "Cannot assign SuperAdmin role via update" });
      }
      user.role = role;
    }

    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    const updated = await user.save();
    res.json({
      id: updated._id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
    });
  } catch (error) {
    console.error("Update User error", error);
    res.status(500).json({ message: error.message });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    const orgId = req.user.organizationId;
    const user = await userModel.findOne({ _id: id, organizationId: orgId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "Owner") {
      const isSuperAdmin = req.user.role === "SuperAdmin";
      const isSelfDeleting = req.user.id === req.params.id;

      if (!isSuperAdmin && !isSelfDeleting) {
        return res.status(403).json({
          message: "Only SuperAdmin or the Owner themselves can delete Owner",
        });
      }
    }

    await userModel.findByIdAndDelete(id);
    res.json({ message: "User deleted" });
  } catch (error) {
    console.error("Delete User error", error);
    res.status(500).json({ message: error.message });
  }
};

export { createUser, getUser, getUsers, deleteUser, updateUser };

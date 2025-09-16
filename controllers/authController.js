import userModel from "../models/userModel.js";
import orgModel from "../models/organizationModel.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const generateTokens = (user) => {
  console.log("JWT_SECRET:", process.env.JWT_SECRET);
  console.log("JWT_REFRESH_SECRET:", process.env.JWT_REFRESH_SECRET);

  const accessToken = jwt.sign(
    {
      id: user._id,
      role: user.role,
      organizationId: user.organizationId || null,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );
  return { accessToken, refreshToken };
};

const register = async (req, res) => {
  try {
    console.log("Incoming body:", req.body);
    const { name, email, password, role, organizationId, assignedClientsIds } =
      req.body;

    if (!["SuperAdmin", "Owner"].includes(role)) {
      return res.status(403).json({
        message: "Only SuperAdmin or Owner can be created via this route",
      });
    }

    if (
      req.originalUrl.includes("/superadmin/register") &&
      role !== "SuperAdmin"
    ) {
      return res
        .status(403)
        .json({ message: "You can only create SuperAdmin via this route" });
    }

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name , email and password are required " });
    }

    if (role === "SuperAdmin") {
      const existingSuperAdmin = await userModel.findOne({
        role: "SuperAdmin",
      });
      if (existingSuperAdmin) {
        return res.status(400).json({
          message: "Super Admin already exists .",
        });
      }
    }

    if (role === "SuperAdmin" && organizationId) {
      return res
        .status(400)
        .json({ message: "Super Admin dont belong to any Organization" });
    }

    if (role !== "SuperAdmin" && !organizationId) {
      return res
        .status(400)
        .json({ message: "Organization required for roles other then admin" });
    }

    const orgId = organizationId || null;
    const orgExists = await orgModel.findById(organizationId);
    if (!orgExists) {
      return res.status(404).json({ message: "Organization does not exist" });
    }
    const normalizedEmail = email.trim().toLowerCase();

    let user = await userModel.findOne({
      normalizedEmail,
      organizationId: orgId,
    });
    if (user) {
      return res.status(400).json({ message: "User already Exists" });
    }

    const existingOwner = await userModel.findOne({
      role: "Owner",
      organizationId: req.body.organizationId,
    });

    if (existingOwner) {
      return res
        .status(400)
        .json({ message: "An owner already exists for this organization" });
    }

    const newUser = new userModel({
      name,
      email: normalizedEmail,
      password,
      role: role || "staff",
      organizationId: role !== "SuperAdmin" ? organizationId : undefined,
      assignedClientsIds,
      isActive: true,
    });

    const salt = await bcrypt.genSalt(10);
    newUser.password = await bcrypt.hash(password, salt);

    await newUser.save();

    const tokens = generateTokens(newUser);

    if (!tokens) {
      return res.status(400).json({ message: "Token not Genrated" });
    }

    res
      .status(200)
      .json({ message: "User Registered Succesfully", newUser, tokens });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error
      return res.status(400).json({
        message: "Email already exists in this organization",
        details: error.keyValue,
      });
    }

    res.status(400).json("User Not registered");
    console.log("Register server error ", error);
  }
};

const login = async (req, res) => {
  const { email, password, organizationId } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    let org = null;
    if (organizationId) {
      org = await orgModel.findById(organizationId).select("name");
      if (!org) {
        return res.status(404).json({ message: "Organization does not exist" });
      }
    }

    const userQuery = organizationId
      ? { email: normalizedEmail, organizationId }
      : { email: normalizedEmail };

    const user = await userModel.findOne(userQuery);

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }


    if (user.role === "SuperAdmin") {
      const superAdmins = await userModel.find({ role: "SuperAdmin" });
      if (superAdmins.length > 1) {
        return res
          .status(403)
          .json({ message: "Multiple SuperAdmins detected. Login blocked." });
      }

      const tokens = generateTokens(user);
      return res.status(200).json({
        message: "SuperAdmin login successful",
        user,
        tokens,
      });
    }

    if (!organizationId) {
      return res.status(400).json({
        message: "Organization ID is required for non-SuperAdmin login",
      });
    }

    if (user.organizationId?.toString() !== organizationId) {
      return res
        .status(403)
        .json({ message: "User does not belong to this organization" });
    }

    const tokens = generateTokens(user);
    res.status(200).json({
      message: "User login successful",
      user,
      organization: { id: organizationId, name: org.name },
      tokens,
    });
  } catch (error) {
    console.error("Login error:", error);
    res
      .status(500)
      .json({ message: "Login server error", error: error.message });
  }
};

export { login, register };

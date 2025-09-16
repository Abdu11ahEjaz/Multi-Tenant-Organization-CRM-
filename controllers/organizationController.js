import orgModel from "../models/organizationModel.js";
import userModel from "../models/userModel.js";
import clientModel from "../models/clientModel.js";
import activityModel from "../models/activityModel.js";
import {
  createCheckoutSessionForOrg,
  planLimits,
  sanitizeLimits
} from "./subscriptionController.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../utils/uploadCloudinary.js";

const createOrg = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Logo file is required" });
    }

    const result = await uploadToCloudinary(req.file.buffer, `org/logo`);
    const orgUrl = result?.secure_url || "";

    const subscriptionPlan = req.body.subscriptionPlan || "Free";

    // For Free plan, create org immediately
    if (subscriptionPlan === "Free") {
      const newOrg = new orgModel({
        name: req.body.name,
        address: req.body.address,
        logo: orgUrl,
        subscriptionPlan,
        limits: planLimits.Free,
      });

      const savedOrg = await newOrg.save();
      return res.status(200).json({ message: "Free Org Created", savedOrg });
    }

    // For paid plans, create Stripe session only
    const sessionUrl = await createCheckoutSessionForOrg(
      {
        name: req.body.name,
        address: req.body.address,
        logo: orgUrl,
        subscriptionPlan,
      },
      req.user.email
    );

    res.status(200).json({ message: "Redirect to Stripe", sessionUrl });
  } catch (error) {
    console.error("Org creation error:", error);
    res.status(500).json({ message: "Server error during org creation" });
  }
};

const updateOrg = async (req, res) => {
  const { id } = req.params;

  try {
    let orgUrl;

    // Upload new logo if provided
    if (req.file) {
      console.log("Uploading new Logo...");
      const result = await uploadToCloudinary(req.file.buffer, "org/logo");
      orgUrl = result?.secure_url || "";
      console.log("Logo upload result:", result);
    }

    const existingOrg = await orgModel.findById(id).lean();
    if (!existingOrg) {
      return res.status(404).json({ message: "Organization not found" });
    }

    // Delete old logo from Cloudinary if new one is uploaded
    if (req.file && existingOrg.logo) {
      const parts = existingOrg.logo.split("/");
      const publicId = parts[parts.length - 1].split(".")[0];
      try {
        await deleteFromCloudinary(`org/logo/${publicId}`);
        console.log("Old logo deleted:", publicId);
      } catch (err) {
        console.warn("Failed to delete old logo:", err.message);
      }
    }

    const updateData = {};
    if (req.body.name) updateData.name = req.body.name;
    if (req.body.address) updateData.address = req.body.address;
    if (orgUrl) updateData.logo = orgUrl;

    // Only allow subscriptionPlan/limits update if role is SuperAdmin
    if (req.user.role === "SuperAdmin") {
      if (req.body.subscriptionPlan)
        updateData.subscriptionPlan = req.body.subscriptionPlan;
      if (req.body.limits) updateData.limits = req.body.limits;
    }

    const updatedOrg = await orgModel.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!updatedOrg) {
      return res
        .status(404)
        .json({ message: "Organization not found after update" });
    }

    res
      .status(200)
      .json({ message: "Organization updated successfully", org: updatedOrg });
  } catch (error) {
    console.error("Update Org server error:", error);
    res.status(500).json({ message: "Update org server error", error });
  }
};


const getOrgs = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;

    const query = {};
    if (search.trim()) {
      query.name = { $regex: search.trim(), $options: "i" };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await orgModel.countDocuments(query);

    const rawOrganizations = await orgModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select("name address logo subscriptionPlan limits createdAt")
      .lean();

    const organizations = rawOrganizations.map((org) => ({
      ...org,
      limits: sanitizeLimits(org.limits),
    }));

    res.status(200).json({
      organizations,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      totalResults: total,
    });
  } catch (error) {
    console.error("Get Orgs error:", error);
    res.status(500).json({
      message: "Failed to fetch organizations",
      error: error.message,
    });
  }
};

const getOrg = async (req, res) => {
  try {
    const org = await orgModel
      .findById(req.params.id)
      .select("-__v")
      .lean();

    if (!org) {
      return res.status(404).json({ message: "Organization not found" });
    }

    const sanitizedOrg = {
      ...org,
      limits: sanitizeLimits(org.limits),
    };

    res.status(200).json({
      message: "Organization retrieved",
      org: sanitizedOrg,
    });
  } catch (error) {
    console.error("Get Org error:", error);
    res.status(500).json({
      message: "Failed to fetch organization",
      error: error.message,
    });
  }
};


const deleteOrg = async (req, res) => {
  const { id } = req.params;

  try {
    if (req.user.role !== "SuperAdmin") {
      return res
        .status(403)
        .json({
          message: "Access denied: Only SuperAdmin can delete organizations",
        });
    }

    const org = await orgModel.findById(id).lean();
    if (!org) {
      return res.status(404).json({ message: "Organization not found" });
    }

    // Delete logo from Cloudinary
    if (org.logo) {
      try {
        const segments = org.logo.split("/");
        const filename = segments[segments.length - 1];
        const publicId = filename.split(".")[0];
        await deleteFromCloudinary(`org/logo/${publicId}`);
        console.log("Logo deleted from Cloudinary:", publicId);
      } catch (err) {
        console.warn("Failed to delete logo from Cloudinary:", err.message);
      }
    }

    // Delete associated users,clients projects activituies and organizAtion
    await userModel.deleteMany({ organizationId: id });

    await clientModel.deleteMany({ organizationId: id });

    await activityModel.deleteMany({ organizationId:id});

    await orgModel.findByIdAndDelete(id);

    res.status(200).json({ message: "Organization deleted successfully" });
  } catch (error) {
    console.error("Delete Organization error:", error);
    res
      .status(500)
      .json({ message: "Server error during deletion", error: error.message });
  }
};

export { createOrg, updateOrg, deleteOrg, getOrgs, getOrg };

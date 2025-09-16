import activityModel from "../models/activityModel.js";
import clientModel from "../models/clientModel.js";
import orgModel from "../models/organizationModel.js";
import userModel from "../models/userModel.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../utils/uploadCloudinary.js";
import {sendEmail} from '../utils/emailQueue.js'
import moment from "moment";

const createActivity = async (req, res) => {
  const { type, date, description, clientId, assignedTo } = req.body;

  try {
    const organizationId = req.body.organizationId || req.user.organizationId;
    const createdBy = req.body.createdBy || req.user.id;

    console.log("Looking for client:", {
      clientId,
      organizationId,
    });

    const client = await clientModel.findOne({ _id: clientId, organizationId });

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    const org = await orgModel.findById(organizationId);
    if (!org) {
      return res.status(404).json({ message: "Organization not found" });
    }

    // Convert "22-10-25" to a valid Date object
    const parsedDate = moment(date, "DD-MM-YY", true).toDate();

    if (!parsedDate || isNaN(parsedDate.getTime())) {
      return res
        .status(400)
        .json({ message: "Invalid date format. Use DD-MM-YY or YYYY-MM-DD." });
    }

    let uploadedFiles = [];

    if (req.files && req.files.length > 0) {
      const totalSizeMB = req.files.reduce(
        (sum, f) => sum + f.size / (1024 * 1024),
        0
      );
      const storageUsed = org.limits?.storageUsed || 0;

      if (storageUsed + totalSizeMB > org.limits.storage) {
        return res
          .status(403)
          .json({ message: "Storage limit reached for your plan" });
      }

      for (const file of req.files) {
        const result = await uploadToCloudinary(
          file.buffer,
          `org/activity_${organizationId}`
        );
        uploadedFiles.push({
          url: result.secure_url,
          label: file.originalname,
          uploadedAt: new Date(),
        });
      }

      org.limits.storageUsed = storageUsed + totalSizeMB;
      await org.save();
    }
    console.log("Parsed date:", parsedDate, "Type:", typeof parsedDate);

    const activity = new activityModel({
      type,
      date: parsedDate,
      description,
      clientId,
      createdBy,
      organizationId,
      files: uploadedFiles,
      assignedTo,
    });

    await activity.save();

    try {
      if (client.email) {
        await sendEmail({
          to: client.email,
          subject: `New ${type} Scheduled`,
          text: `Hi ${
            client.name
          }, a new ${type} has been scheduled for you on ${parsedDate.toLocaleDateString()}.`,
        });
      }

      if (client.assignedTo && client.assignedTo.toString() !== createdBy) {
        const assignedUser = await userModel.findById(client.assignedTo);
        if (assignedUser?.email) {
          await sendEmail({
            to: assignedUser.email,
            subject: `Activity Assigned: ${type}`,
            text: `Hi ${assignedUser.name}, a new ${type} has been logged for client ${client.name}.`,
          });
        }
      }
    } catch (error) {
      console.warn("Failed to notify client:", error.message);
    }

    //  Notify staff if activity is assigned to them
    if (assignedTo && assignedTo.toString() !== createdBy) {
      const staffUser = await userModel.findById(assignedTo);
      if (staffUser?.email) {
        await sendEmail({
          to: staffUser.email,
          subject: `New Activity Assigned: ${type}`,
          text: `Hi ${
            staffUser.name
          }, you’ve been assigned a new ${type} for client ${
            client.name
          } on ${parsedDate.toLocaleDateString()}.`,
        });
      }
    }
    res.status(201).json(activity);
  } catch (error) {
    console.error("Create Activity Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getActivities = async (req, res) => {
  try {
    const { page = 1, limit = 10, clientId, type, search } = req.query;
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res
        .status(401)
        .json({ message: "Unauthorized: Missing organization ID in token" });
    }
    //  Build query dynamically
    const query = { organizationId };

    if (clientId) query.clientId = clientId;
    if (type) query.type = type;
    if (search) {
      query.description = { $regex: search, $options: "i" };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const activities = await activityModel
      .find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("clientId", "name") // Optional: show client name
      .populate("createdBy", "name email") // Optional: show user info
      .lean();

    const total = await activityModel.countDocuments(query);

    res.status(200).json({
      activities,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      totalResults: total,
    });
  } catch (error) {
    console.error("Get Activities Error:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch activities", error: error.message });
  }
};

const getActivity = async (req, res) => {
  try {
    const { clientId } = req.params;
    const organizationId = req.user.orgId;

    if (!clientId) {
      return res.status(400).json({ message: "Client ID is required" });
    }

    const activity = await activityModel
      .findOne({ clientId, organizationId })
      .sort({ date: -1 }) 
      .populate("clientId", "name")
      .populate("createdBy", "name email")
      .lean();

    if (!activity) {
      return res
        .status(404)
        .json({ message: "No activity found for this client" });
    }

    res.status(200).json({ activity });
  } catch (error) {
    console.error("Get Single Activity Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const updateActivity = async (req, res) => {
  const { type, date, description, clientId } = req.body;
  const { id } = req.params;

  try {
    const organizationId = req.body.organizationId || req.user.organizationId;
    const createdBy = req.body.createdBy || req.user.id;
    if (!createdBy) {
      return res.status(400).json({ message: "Created by isnt avaialble" });
    }

    const activity = await activityModel.findOne({
      _id: id,
      organizationId,
    });
    if (!activity) {
      return res.status(404).json({ message: "Activity not found" });
    }

    const client = await clientModel.findOne({ _id: clientId, organizationId });
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    const org = await orgModel.findById(organizationId);
    if (!org) {
      return res.status(404).json({ message: "Organization not found" });
    }

    let uploadedFiles = [];

    if (req.files && req.files.length > 0) {
      const totalSizeMB = req.files.reduce(
        (sum, f) => sum + f.size / (1024 * 1024),
        0
      );
      const storageUsed = org.limits?.storageUsed || 0;

      if (storageUsed + totalSizeMB > org.limits.storage) {
        return res
          .status(403)
          .json({ message: "Storage limit reached for your plan" });
      }

      //  Delete old files from Cloudinary
      if (activity.files && activity.files.length > 0) {
        for (const file of activity.files) {
          const segments = file.url.split("/");
          const filename = segments[segments.length - 1];
          const publicId = filename.split(".")[0];
          await deleteFromCloudinary(
            `org/activity_${organizationId}/${publicId}`
          );
        }
      }

      if (
        activity.createdBy.toString() !== req.user.id &&
        req.user.role !== "Admin"
      ) {
        return res.status(403).json({
          message:
            "Access denied: Only creator or admin can modify this activity",
        });
      }

      // Upload new files
      for (const file of req.files) {
        const result = await uploadToCloudinary(
          file.buffer,
          `org/activity_${organizationId}`
        );
        uploadedFiles.push({
          url: result.secure_url,
          label: file.originalname,
          uploadedAt: new Date(),
        });
      }

      org.limits.storageUsed = storageUsed + totalSizeMB;
      await org.save();
    }


    activity.type = type || activity.type;
    activity.date = date || activity.date;
    activity.description = description || activity.description;
    activity.clientId = clientId || activity.clientId;
    activity.createdBy = createdBy || activity.createdBy;
    if (uploadedFiles.length > 0) {
      activity.files = uploadedFiles;
    }

    await activity.save();

    const formattedDate = moment(activity.date, "DD-MM-YY", true).isValid()
      ? moment(activity.date, "DD-MM-YY").format("MMMM D, YYYY")
      : "an invalid date";

    if (client.email) {
      await sendEmail({
        to: client.email,
        subject: `Updated ${type} Scheduled`,
        text: `Hi ${client.name}, a updated ${type} has been scheduled for you on ${formattedDate}.`,
      });
    }

    if (client.assignedTo && client.assignedTo.toString() !== createdBy) {
      const assignedUser = await userModel.findById(client.assignedTo);
      if (assignedUser?.email) {
        await sendEmail({
          to: assignedUser.email,
          subject: `Activity Assigned: ${type}`,
          text: `Hi ${assignedUser.name}, a new ${type} has been logged for client ${client.name}.`,
        });
      }
    }

    res
      .status(200)
      .json({ message: "Activity updated successfully", activity });
  } catch (error) {
    console.error("Update Activity Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const deleteActivity = async (req, res) => {
  const { activityId } = req.params;
  const organizationId = req.user.organizationId || req.body.organizationId;

  try {
    const activity = await activityModel.findOne({
      id: activityId,
      organizationId,
    });
    if (!activity) {
      return res.status(404).json({ message: "Activity not found" });
    }

    if (
      activity.createdBy.toString() !== req.user.id &&
      req.user.role !== "Admin"
    ) {
      return res.status(403).json({
        message:
          "Access denied: Only creator or admin can modify this activity",
      });
    }
    //  Delete all associated files from Cloudinary
    if (activity.files && activity.files.length > 0) {
      for (const file of activity.files) {
        const segments = file.url.split("/");
        const filename = segments[segments.length - 1]; // e.g. abc123.jpg
        const publicId = filename.split(".")[0]; // remove extension
        await deleteFromCloudinary(
          `org/activity_${organizationId}/${publicId}`
        );
      }
    }

    const client = await clientModel.findOne({
      _id: activity.clientId,
      organizationId,
    });
    if (!client) {
      return res.status(400).json({ message: "Client not found" });
    }

    const formattedDate = new Date(activity.date).toLocaleDateString();
    const type = activity.type;
    const createdBy = activity.createdBy.toString();

    if (client?.email) {
      try {
        await sendEmail({
          to: client.email,
          subject: `Activity Cancelled: ${type}`,
          text: `Hi ${client.name}, your scheduled ${type} on ${formattedDate} has been cancelled.`,
        });
      } catch (err) {
        console.warn("Failed to notify client:", err.message);
      }
    }

    if (client?.assignedTo && client.assignedTo.toString() !== req.user.id) {
      const assignedUser = await userModel.findById(client.assignedTo);
      if (assignedUser?.email) {
        try {
          await sendEmail({
            to: assignedUser.email,
            subject: `Client ${type} Cancelled`,
            text: `Hi ${assignedUser.name}, the ${type} scheduled for client ${client.name} on ${formattedDate} has been cancelled.`,
          });
        } catch (err) {
          console.warn("Failed to notify assigned staff:", err.message);
        }
      }
    }

    await activity.deleteOne();

    res
      .status(200)
      .json({ message: "Activity and associated files deleted successfully" });
  } catch (error) {
    console.error("Delete Activity Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export {
  createActivity,
  getActivities,
  getActivity,
  updateActivity,
  deleteActivity,
};

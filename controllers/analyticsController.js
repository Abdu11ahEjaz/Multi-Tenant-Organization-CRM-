import { Parser } from "json2csv";
import clientModel from "../models/clientModel.js";
import activityModel from "../models/activityModel.js";
import mongoose from "mongoose";

const getClientAnalytics = async (req, res) => {
  try {
    console.log("Org ID in request:", req.user.organizationId);

    const orgId = new mongoose.Types.ObjectId(req.user.organizationId);

    const clientsPerMonth = await clientModel.aggregate([
      { $match: { organizationId: orgId } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          year: "$_id.year",
          month: "$_id.month",
          count: 1,
          _id: 0,
        },
      },
      { $sort: { year: 1, month: 1 } },
    ]);

    res.json(clientsPerMonth);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getActiveUsers = async (req, res) => {
  try {
    const orgId = new mongoose.Types.ObjectId(req.user.organizationId);

    console.log("Resolved orgId:", req.user.organizationId);
    const activities = await activityModel.find({ organizationId: orgId });
    console.log("Matched activities:", activities.length);

    const activeUsers = await activityModel.aggregate([
      { $match: { organizationId: orgId } },
      {
        $group: {
          _id: "$assignedTo",
          activityCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          name: "$user.name",
          email: "$user.email",
          activityCount: 1,
          _id: 0,
        },
      },
      { $sort: { activityCount: -1 } },
    ]);

    res.json(activeUsers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Export clients to CSV
const exportClients = async (req, res) => {
  try {
    const clients = await clientModel
      .find({ organizationId: req.user.organizationId })
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .lean();

    const fields = [
      { label: "Name", value: "name" },
      { label: "Email", value: "email" },
      { label: "Phone", value: "phone" },
      { label: "Company", value: "company" },
      { label: "Tags", value: "tags" },
      { label: "Assigned To", value: "assignedTo.name" },
      { label: "Created By", value: "createdBy.name" },
      { label: "Created At", value: "createdAt" },
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(clients);

    res.header("Content-Type", "text/csv");
    res.attachment("clients.csv");
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Export activities to CSV
const exportActivities = async (req, res) => {
  try {
    const activities = await activityModel
      .find({ organizationId: req.user.organizationId })
      .populate("clientId", "name email")
      .populate("assignedTo", "name email")
      .lean();

    const fields = [
      { label: "Type", value: "type" },
      { label: "Date", value: "date" },
      { label: "Description", value: "description" },
      { label: "Client Name", value: "clientId.name" },
      { label: "Assigned To", value: "assignedTo.name" },
      { label: "Created At", value: "createdAt" },
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(activities);

    res.header("Content-Type", "text/csv");
    res.attachment("activities.csv");
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export { getClientAnalytics, getActiveUsers, exportActivities, exportClients };

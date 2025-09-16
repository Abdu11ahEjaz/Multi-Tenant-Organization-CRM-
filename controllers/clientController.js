import Client from "../models/clientModel.js";
import organizationModel from "../models/organizationModel.js";
import userModel from "../models/userModel.js";
import { sendEmail } from "../utils/emailQueue.js";

const createClient = async (req, res) => {
  const { name, email, phone, company, tags, assignedTo } = req.body;

  if (!name || !email || !phone) {
    return res
      .status(400)
      .json({ message: "Name, email, and phone are required" });
  }

  try {
    const orgId = req.user.organizationId;
    const creatorId = req.user.id;

    const org = await organizationModel.findById(orgId);
    if (!org) {
      return res.status(404).json({ message: "Organization not found" });
    }

    const normalizedEmail = email.toLowerCase();
    const existingClient = await Client.findOne({
      email: normalizedEmail,
      organizationId: orgId,
    });
    if (existingClient) {
      return res
        .status(400)
        .json({ message: "Client email already exists in this organization" });
    }

    if (org.limits.clients !== -1) {
      const clientCount = await Client.countDocuments({
        organizationId: orgId,
      });
      if (clientCount >= org.limits.clients) {
        return res
          .status(403)
          .json({ message: "Client limit reached for your plan" });
      }
    }

    let finalAssignedTo = assignedTo;

    // Auto-assign to Admin if Free plan and no assignedTo
    if (!assignedTo && org.subscriptionPlan === "Free") {
      const adminUser = await userModel.findOne({
        organizationId: orgId,
        role: "Admin",
      });
      if (adminUser) {
        finalAssignedTo = adminUser._id;
      }
    }

    const client = new Client({
      name,
      email: normalizedEmail,
      phone,
      company,
      tags,
      assignedTo: finalAssignedTo,
      createdBy: creatorId,
      organizationId: orgId,
    });

    await client.save();
    res.status(201).json(client);

    try {
      const parsedDate = new Date();
      if (client.email) {
        await sendEmail({
          to: client.email,
          subject: `Client created successfully `,
          text: `Hi ${
            client.name
          }, a client account has been created for you on ${parsedDate.toLocaleDateString()}.`,
        });
      }

      if (client.assignedTo && client.assignedTo.toString() !== creatorId) {
        const assignedUser = await userModel.findById(client.assignedTo);
        if (assignedUser?.email) {
          await sendEmail({
            to: assignedUser.email,
            subject: `New Client Assigned`,
            text: `Hi ${assignedUser.name}, a new Client ${client.name} has been assigned to you.`,
          });
        }
      }
     } catch (error) {
      console.warn("Failed to notify client and assigned staff:", error.message);
    }



  } catch (error) {
    console.error("Create Client error:", error);
    res.status(500).json({ message: error.message });
  }
};

// get all clients
const getClients = async (req, res) => {
  const { search, tags, page = 1, limit = 10 } = req.query;

  try {
    const orgId = req.user.organizationId;
    const role = req.user.role;
    const userId = req.user.id;

    if (!orgId) {
      return res
        .status(400)
        .json({ message: "Organization ID is missing or invalid" });
    }

    const query = { organizationId: orgId };

    //  Restrict Staff to only see their assigned clients
    if (role === "Staff") {
      query.assignedTo = userId;
    }

    // Text search (requires text index on name/company/tags)
    if (search) {
      query.$text = { $search: search };
    }

    // Tag filtering
    if (tags) {
      query.tags = { $in: tags.split(",") };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Client.countDocuments(query);

    const clients = await Client.find(query)
      .populate("assignedTo", "name email role")
      .populate("createdBy", "name email role")
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
      data: clients,
    });
  } catch (error) {
    console.error("Get Clients error:", error);
    res.status(500).json({ message: error.message });
  }
};


const getClientById = async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const clientId = req.params.id;
    const role = req.user.role;
    const userId = req.user.id;

    if (!orgId) {
      return res
        .status(400)
        .json({ message: "Organization ID is missing or invalid" });
    }

    const query = {
      _id: clientId,
      organizationId: orgId,
    };

    //  Restrict Staff to only access their assigned clients
    if (role === "Staff") {
      query.assignedTo = userId;
    }

    const client = await Client.findOne(query)
      .populate("assignedTo", "name email role")
      .populate("createdBy", "name email role")
      .lean();

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    res.status(200).json(client);
  } catch (error) {
    console.error("Get Client by ID error:", error);
    res.status(500).json({ message: error.message });
  }
};

const updateClient = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(200).json({ mesage: "id not provided" });
  }
  const { name, email, phone, company, tags, assignedTo } = req.body;

  try {
    const orgId = req.user.organizationId;
    const userId = req.user.id;
    const role = req.user.role;

    
    const client = await Client.findOne({ _id: id, organizationId: orgId });
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }


    if (role === "Staff" && client.assignedTo?.toString() !== userId) {
      return res
        .status(403)
        .json({ message: "Access denied: Not assigned to this client" });
    }

    
    const normalizedEmail = email?.toLowerCase();
    if (normalizedEmail && normalizedEmail !== client.email) {
      const existingClient = await Client.findOne({
        email: normalizedEmail,
        organizationId: orgId,
      });
      if (existingClient) {
        return res
          .status(400)
          .json({ message: "Email already exists in this organization" });
      }
      client.email = normalizedEmail;
    }


    let finalAssignedTo = assignedTo;
    const org = await organizationModel.findById(orgId);
    if (!assignedTo && org?.subscriptionPlan === "Free") {
      const adminUser = await userModel.findOne({
        organizationId: orgId,
        role: "Admin",
      });
      if (adminUser) {
        finalAssignedTo = adminUser._id;
      }
    }


    client.name = name || client.name;
    client.phone = phone || client.phone;
    client.company = company || client.company;
    client.tags = tags || client.tags;
    client.assignedTo = finalAssignedTo || client.assignedTo;

    await client.save();

    res.json(client);
  } catch (error) {
    console.error("Update Client error:", error);
    res.status(500).json({ message: error.message });
  }
};


const deleteClient = async (req, res) => {
  const { id } = req.params;

  try {
    const orgId = req.user.organizationId;
    const userId = req.user.id;
    const role = req.user.role;


    const client = await Client.findOne({ _id: id, organizationId: orgId });
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }


    if (role === "Staff" && client.assignedTo?.toString() !== userId) {
      return res
        .status(403)
        .json({ message: "Access denied: Not assigned to this client" });
    }


    await client.deleteOne();

    res.json({ message: "Client deleted successfully" });
  } catch (error) {
    console.error("Delete Client error:", error);
    res.status(500).json({ message: error.message });
  }
};

export { createClient, getClients, getClientById, updateClient, deleteClient };

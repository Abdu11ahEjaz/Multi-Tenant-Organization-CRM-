import organizationModel from '../models/organizationModel.js';
import userModel from '../models/userModel.js';
import clientModel from '../models/clientModel.js';
import activityModel from '../models/activityModel.js';

const getDashboard = async (req, res) => {
  try {
    if (req.user.role !== 'SuperAdmin') {
      return res.status(403).json({ message: 'Access denied: SuperAdmin only' });
    }

    const orgs = await organizationModel.find().lean();

    const stats = await Promise.all(
      orgs.map(async (org) => {
        const userCount = await userModel.countDocuments({ organizationId: org._id });
        const clientCount = await clientModel.countDocuments({ organizationId: org._id });
        const activityCount = await activityModel.countDocuments({ organizationId: org._id });

        const activeUserIds = await activityModel.distinct('assignedTo', { organizationId: org._id });
        const activeUsers = activeUserIds.length;

        return {
          orgId: org._id,
          name: org.name,
          plan: org.plan,
          subscriptionStatus: org.subscriptionStatus || (org.plan === 'Free' ? 'Free' : 'Active'),
          userCount,
          activeUsers,
          clientCount,
          activityCount,
          limits: {
            users: org.limits?.users || 0,
            clients: org.limits?.clients || 0,
            storage: org.limits?.storage || 0,
            storageUsed: org.limits?.storageUsed || 0
          },
          usageVsLimits: {
            users: `${userCount}/${org.limits?.users || 0}`,
            clients: `${clientCount}/${org.limits?.clients || 0}`,
            storage: `${(org.limits?.storageUsed || 0).toFixed(2)}/${org.limits?.storage || 0} MB`
          }
        };
      })
    );

    res.json({ organizations: stats });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export {getDashboard};

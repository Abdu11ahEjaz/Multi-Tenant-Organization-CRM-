import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();
import activityModel from "../models/activityModel.js";
console.log("Email user:", process.env.EMAIL_USER);
console.log(
  "Email pass:",
  process.env.EMAIL_PASSWORD ? "Available" : " Missing"
);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASSWORD, 
  },
});

// Reusable function to send emails
const sendEmail = async ({ to, subject, text }) => {
  const mailOptions = {
    from: `"Multi-Tanent App notifications" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
    return info;
  } catch (error) {
    console.error("Email sending failed:", error.message);
    throw error;
  }
};

// Send notifications for activities scheduled today
const sendDailyActivityNotifications = async () => {
  console.log(
    " Cron job triggered at",
    new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" })
  );
  try {
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999); 

    const activities = await activityModel
      .find({
        date: { $gte: today, $lte: endOfDay },
      })
      .populate("clientId", "name email")
      .populate("assignedTo", "email name organizationId");

    console.log(" Activities found:", activities.length);

    // Group activities by staff user for efficient emailing
    const userActivities = {};
    for (const activity of activities) {
      const user = activity.assignedTo;
      if (user && user._id) {
        const userId = user._id.toString();
        if (!userActivities[userId]) {
          userActivities[userId] = {
            email: user.email,
            name: user.name,
            organizationId: user.organizationId,
            activities: [],
          };
        }
        userActivities[userId].activities.push(activity);

        console.log(
          `Queued email for ${user.email} with ${userActivities[userId].activities.length} activities`
        );
      }

      const client = activity.clientId;
      if (client?.email) {
        const clientText = `Hello ${client.name},\n\nYou have a scheduled ${
          activity.type
        } today (${today.toDateString()}) at ${new Date(
          activity.date
        ).toLocaleTimeString()}.\n\nDetails: ${
          activity.description || "No description"
        }\n\nBest regards,\nCRM Team`;

        await sendEmail({
          to: client.email,
          subject: `Reminder: ${activity.type} Today`,
          text: clientText,
        });

        console.log(` Email sent to client ${client.email}`);
      }
    }

    // Send email to each staff user with their grouped activities
    for (const userId in userActivities) {
      const { email, name, activities } = userActivities[userId];
      const text = `Hello ${name},\n\nYou have the following activities scheduled today (${today.toDateString()}):\n${activities
        .map(
          (a) =>
            `- ${a.type} with ${a.clientId.name} at ${new Date(
              a.date
            ).toLocaleTimeString()}: ${a.description || "No description"}`
        )
        .join("\n")}\n\nBest regards,\nCRM Team`;

      await sendEmail({
        to: email,
        subject: `Today's Activities - ${today.toDateString()}`,
        text,
      });

      console.log(` Email sent to staff ${email}`);
    }
  } catch (error) {
    console.error("Error sending daily activity notifications:", error.message);
  }
};
export { sendEmail, sendDailyActivityNotifications };

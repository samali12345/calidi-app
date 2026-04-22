const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      minlength: 2,
      maxlength: 60,
    },
    mobileNumber: {
      type: String,
      trim: true,
      validate: {
        validator: function (value) {
          if (!value) return true;
          return /^\+?\d{7,15}$/.test(value);
        },
        message: "Invalid mobile number format",
      },
    },
    pushTokens: [
      {
        token: { type: String, required: true },
        userAgent: { type: String, default: "" },
        createdAt: { type: Date, default: Date.now },
        lastSeenAt: { type: Date, default: Date.now },
      },
    ],
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    isVerified: {
      type: Boolean,
      default: true,
    },
    verificationToken: {
      type: String,
    },
    verificationTokenExpires: {
      type: Date,
    },
    role: {
      type: String,
      enum: ["customer", "admin", "rider"],
      default: "customer",
    },
    riderApprovalStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
    },
    riderAppliedAt: {
      type: Date,
      default: null,
    },
    isAvailable: {
      type: Boolean,
      default: false,
    },
    vehicleType: {
      type: String,
      enum: ["bike", "threewheel", "van"],
      default: "bike",
    },
    loyaltyTier: {
      type: String,
      enum: ["none", "silver", "gold"],
      default: "none",
    },
    loyaltyPoints: {
      type: Number,
      default: 0,
    },
    totalOrders: {
      type: Number,
      default: 0,
    },
    pointsEarnedAt: {
      type: Date,
      default: null,
    },
    pointsExpiryWarnedAt: {
      type: Date,
      default: null,
    },
    pointsExpiryWarnedFor: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);

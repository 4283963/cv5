import mongoose from 'mongoose';

const scoreSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, '用户名不能为空'],
      trim: true,
      minlength: [1, '用户名至少 1 个字符'],
      maxlength: [12, '用户名最多 12 个字符'],
    },
    score: {
      type: Number,
      required: [true, '分数不能为空'],
      min: [0, '分数不能为负'],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false }
);

scoreSchema.index({ score: -1 });

export const Score = mongoose.model('Score', scoreSchema);

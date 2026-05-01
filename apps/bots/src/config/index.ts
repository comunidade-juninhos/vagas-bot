const envFlag = (name: string, fallback = true) => {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

export const config = {
  port: Number(process.env.PORT || 3000),
  whatsapp: {
    enabled: envFlag("WHATSAPP_ENABLED", false),
    groupId: process.env.WHATSAPP_GROUP_ID,
    authMethod: process.env.AUTH_METHOD || "code",
    mobileNumber: process.env.MOBILE_NUMBER
  },
  discord: {
    enabled: envFlag("DISCORD_ENABLED", true),
    token: process.env.DISCORD_TOKEN,
    channelId: process.env.DISCORD_CHANNEL_ID
  },
  webhook: {
    secret: process.env.WEBHOOK_SECRET
  }
};

import "dotenv/config";
import { runCycle } from "./index.js";
import { disconnectDatabase } from "#root/services/database.js";

const run = async () => {
  try {
    await runCycle();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
    process.exit();
  }
};

run();

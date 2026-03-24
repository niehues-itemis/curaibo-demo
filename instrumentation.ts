export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startCronScheduler } = await import("@/lib/connectors/cron-scheduler");
    startCronScheduler();
  }
}

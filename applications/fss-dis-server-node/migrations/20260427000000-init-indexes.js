/**
 * Establish all collection indexes explicitly so they are reproducible
 * across environments and independent of Mongoose auto-index behaviour.
 *
 * Collections managed here:
 *   users, usermetrics, analysisenvs,
 *   resourcerequests, resourceallocations,
 *   environmentrequests, environmentassignments,
 *   userpods
 */

export async function up(db) {
  // users
  await db.collection("users").createIndex({ username: 1 }, { unique: true, name: "username_1" });

  // usermetrics  (Mongoose model → collection "usermetrics")
  await db.collection("usermetrics").createIndex({ username: 1 }, { unique: true, name: "username_1" });

  // analysisenvs  (Mongoose model "AnalysisEnvironment" → "analysisenvs")
  await db.collection("analysisenvs").createIndex({ envId: 1 }, { unique: true, name: "envId_1" });

  // resourcerequests
  await db.collection("resourcerequests").createIndex({ requestId: 1 }, { unique: true, name: "requestId_1" });
  await db.collection("resourcerequests").createIndex({ username: 1, status: 1 }, { name: "username_1_status_1" });

  // resourceallocations
  await db.collection("resourceallocations").createIndex({ username: 1 }, { unique: true, name: "username_1" });

  // environmentrequests
  await db.collection("environmentrequests").createIndex({ requestId: 1 }, { unique: true, name: "requestId_1" });
  await db.collection("environmentrequests").createIndex({ username: 1, status: 1 }, { name: "username_1_status_1" });

  // environmentassignments
  await db.collection("environmentassignments").createIndex({ username: 1 }, { unique: true, name: "username_1" });

  // userpods  (raw collection, not a Mongoose model)
  await db.collection("userpods").createIndex({ username: 1 }, { unique: true, name: "username_1" });
}

export async function down(db) {
  await db.collection("users").dropIndex("username_1");
  await db.collection("usermetrics").dropIndex("username_1");
  await db.collection("analysisenvs").dropIndex("envId_1");
  await db.collection("resourcerequests").dropIndex("requestId_1");
  await db.collection("resourcerequests").dropIndex("username_1_status_1");
  await db.collection("resourceallocations").dropIndex("username_1");
  await db.collection("environmentrequests").dropIndex("requestId_1");
  await db.collection("environmentrequests").dropIndex("username_1_status_1");
  await db.collection("environmentassignments").dropIndex("username_1");
  await db.collection("userpods").dropIndex("username_1");
}

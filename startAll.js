// startAll.js
const { spawn } = require("child_process");

const servers = [
  { name: "Upload Server", cmd: "node", args: ["server.js"] },
  { name: "Point Server", cmd: "node", args: ["point.js"] },
    { name: "mail Server", cmd: "node", args: ["mail.js"] },

];

// Chạy song song cả 2 server
servers.forEach((s) => {
  console.log(`🚀 Starting ${s.name}...`);
  const proc = spawn(s.cmd, s.args, { stdio: "inherit" });
  proc.on("close", (code) => {
    console.log(`❌ ${s.name} exited with code ${code}`);
  });
});

const fs = require("node:fs");

fs.mkdirSync("bin", { recursive: true });

fs.writeFileSync(
    "bin/captain-hello",
    "#!/bin/sh\n" +
    'echo "Captain ecosystem integration successful!"\n',
    { mode: 0o755 }
);

const BASE_URL = "http://localhost:3000";

async function run() {
  console.log("🚀 Testando API...\n");

  // 1. Criar vaga
  const payload = {
    source: "remotar",
    title: "Senior Fullstack Dev",
    company: "BananaTech Inc 🍌",
    location: "Remoto",
    workMode: "remote",
    seniority: "senior",
    url: "https://banana.jobs/dev-123",
    description: "Trabalhe com Node, React e bananas altamente escaláveis.",
    stack: ["node", "react", "mongodb"],
    scrapedAt: new Date().toISOString(),
  };

  console.log("📤 Criando vaga...");

  const createRes = await fetch(`${BASE_URL}/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const created = await createRes.json();
  console.log("✅ Resultado criação:", created);

  // 2. Buscar vagas
  console.log("\n📥 Buscando vagas...");

  const listRes = await fetch(`${BASE_URL}/jobs`);
  const list = await listRes.json();

  console.log("📦 Lista:", JSON.stringify(list, null, 2));

  // 3. Testar duplicata
  console.log("\n🔁 Testando duplicata...");

  const dupRes = await fetch(`${BASE_URL}/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const dup = await dupRes.json();
  console.log("♻️ Resultado duplicata:", dup);

  console.log("\n🔥 Teste finalizado");
}

run().catch(console.error);

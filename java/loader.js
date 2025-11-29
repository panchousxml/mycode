fetch("https://cdn.jsdelivr.net/gh/panchousxml/mycode@main/java/version.json?" + Date.now())
  .then(r => r.json())
  .then(({ build }) => {
    const playerUrl = `https://cdn.jsdelivr.net/gh/panchousxml/mycode@main/java/player.${build}.js`;
    const script = document.createElement("script");

    script.src = playerUrl;
    document.body.appendChild(script);
  })
  .catch(err => console.error("Version load error:", err));

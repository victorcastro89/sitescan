let Wappalyzer;

(async () => {
  Wappalyzer = (await import('./wappalyzer/src/drivers/npm/driver.js')).default;

  const url = ['https://simplificandotecnologia.site/','http://qrxcode.com.br/']

  const options = {
    debug: false,
    delay: 0,
    headers: {},
    maxDepth: 3,
    maxUrls: 10,
    maxWait: 40000,
    recursive: false,
    probe: true,
    proxy: false,
    userAgent: 'Wappalyzer',
    htmlMaxCols: 2000,
    htmlMaxRows: 2000,
    noScripts: false,
    noRedirect: false,
  };
  
  const wappalyzer = new Wappalyzer(options)
  
  ;(async function() {
    try {
      await wappalyzer.init()
  
      // Optionally set additional request headers
      const headers = {}
  
      // Optionally set local and/or session storage
      const storage = {
        local: {}
     
      }
  
      const site = await wappalyzer.open(url[0], headers, storage)
  
      // Optionally capture and output errors
      // site.on('error', (x)=>console.log(x.message.code))
      try{
        const results = await site.analyze()
         console.log(JSON.stringify(results, null, 2))
        // console.log(results.technologies.length);
      }
catch(e){
   console.log(e);
}
  

    } catch (error) {
      console.error(error)
    }
  
    await wappalyzer.destroy()
  })()
})();


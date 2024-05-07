import { analyzeSiteTechnologiesParallel } from "./wapp.ts";

analyzeSiteTechnologiesParallel(["luizsergionutricionista.com.br"]).then(x=>console.log(x)).catch((err)=>console.error(err))
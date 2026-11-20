/** Projects registered for initial pilot; this catalog contains no private customer information. */
export const PROJECTS = Object.freeze([
  {id:'smith-academy',name:'SMITH Academy AI',category:'education',currency:'RON',repository:'romaniapromovata/smith-academy-ai'},
  {id:'romania-promovata',name:'România Promovată',category:'tourism',currency:'RON',repository:'romaniapromovata/rom-nia-promovat'},
  {id:'suisse-promoted',name:'Suisse Promoted',category:'tourism',currency:'CHF',repository:'Filipmoldovan/suisse-promoted'},
  {id:'corfils',name:'CORFILS',category:'commerce',currency:'RON',repository:'Filipmoldovan/corfils-deploy'},
  {id:'electrohelp-es',name:'Servicio Técnico Madrid',category:'services',currency:'EUR',repository:'Filipmoldovan/electrohelp-es-platform'},
  {id:'casa-cu-piese',name:'Casa cu Piese',category:'commerce',currency:'RON',repository:'Filipmoldovan/casacupiese'}
]);
export const PROJECT_IDS = new Set(PROJECTS.map(p=>p.id));
export const METRICS = Object.freeze({
  leads:{label:'Solicitări',type:'count'},
  conversions:{label:'Conversii',type:'count'},
  orders:{label:'Comenzi',type:'count'},
  active_users:{label:'Utilizatori activi',type:'count'},
  tickets:{label:'Tichete de suport',type:'count'},
  revenue_minor:{label:'Venituri',type:'money'},
  costs_minor:{label:'Costuri',type:'money'}
});
export const AGENTS = Object.freeze(['research','marketing','sales','support','developer','finance','atlas','control']);

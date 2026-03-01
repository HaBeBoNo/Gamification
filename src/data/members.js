export const ROLE_TYPES = {
  amplifier: {
    label: 'Amplifier', icon: '📢',
    desc: 'Synlig extern output — räckvidd och engagemang är din valuta',
    workMult: 1.0, engageMult: 1.0, milestoneMult: 1.0, xpScaling: 1.0,
    scoreColor: '#a050e0',
    hiddenCats: ['wisdom','health','social'], hiddenBlock: [],
  },
  enabler: {
    label: 'Enabler', icon: '⚙️',
    desc: 'Osynlig multiplikator — utan dig faller allt annat',
    workMult: 1.8, engageMult: 0.0, milestoneMult: 2.0, xpScaling: 1.4,
    scoreColor: '#40c080',
    hiddenCats: ['wisdom','health','tech'], hiddenBlock: ['social'],
  },
  builder: {
    label: 'Builder', icon: '🏗️',
    desc: 'Strukturellt fundament — din effekt syns månader senare',
    workMult: 1.4, engageMult: 0.3, milestoneMult: 1.6, xpScaling: 1.2,
    scoreColor: '#c8a040',
    hiddenCats: ['wisdom','money','health'], hiddenBlock: [],
  },
};

export const ROLE_MULT = {
  amplifier: ROLE_TYPES.amplifier.workMult,
  enabler:   ROLE_TYPES.enabler.workMult,
  builder:   ROLE_TYPES.builder.workMult,
};

export const ROLE_TYPE_LABEL = {
  amplifier: { label: ROLE_TYPES.amplifier.label, color: ROLE_TYPES.amplifier.scoreColor, desc: ROLE_TYPES.amplifier.desc },
  enabler:   { label: ROLE_TYPES.enabler.label,   color: ROLE_TYPES.enabler.scoreColor,   desc: ROLE_TYPES.enabler.desc   },
  builder:   { label: ROLE_TYPES.builder.label,   color: ROLE_TYPES.builder.scoreColor,   desc: ROLE_TYPES.builder.desc   },
};

export const MEMBERS = {
  hannes:   { name:'Hannes',   role:'Brand Manager',      emoji:'🎨', color:'rgba(200,100,50,0.15)',  xpColor:'#e07840', roleType:'amplifier' },
  ludvig:   { name:'Ludvig',   role:'Ordförande',         emoji:'👑', color:'rgba(64,192,80,0.12)',   xpColor:'#40c060', roleType:'builder'   },
  martin:   { name:'Martin',   role:'Head of Production', emoji:'🎛️', color:'rgba(64,128,224,0.12)', xpColor:'#4090e0', roleType:'enabler'   },
  nisse:    { name:'Nisse',    role:'PR & Outreach',      emoji:'📡', color:'rgba(160,80,224,0.12)', xpColor:'#a050e0', roleType:'amplifier' },
  simon:    { name:'Simon',    role:'Business Manager',   emoji:'💼', color:'rgba(224,80,64,0.12)',  xpColor:'#e06050', roleType:'builder'   },
  johannes: { name:'Johannes', role:'Logistics',          emoji:'🗂️', color:'rgba(64,160,224,0.12)', xpColor:'#40a0e0', roleType:'enabler'   },
  carl:     { name:'Carl',     role:'Grants',             emoji:'📋', color:'rgba(200,160,64,0.12)', xpColor:'#c8a040', roleType:'builder'   },
  niklas:   { name:'Niklas',   role:'Tech Manager',       emoji:'⚙️', color:'rgba(64,192,128,0.12)', xpColor:'#40c080', roleType:'enabler'   },
};

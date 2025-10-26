const J=r=>r.json();
export const api={
  health(){return fetch('/api/health').then(J);},
  listSessions(options={}){return Promise.resolve([
    {id:1001,name:'Gara Monza',date:'2025-10-26 15:10',duration_min:45},
    {id:1002,name:'Test Imola',date:'2025-10-26 16:20',duration_min:30},
    {id:1003,name:'Qualifica Mugello',date:'2025-10-26 18:30',duration_min:20},
    {id:1004,name:'Pratica Vallelunga',date:'2025-10-25 10:15',duration_min:60},
    {id:1005,name:'Test Setup',date:'2025-10-25 14:45',duration_min:25},
    {id:1006,name:'Giro Veloce Monza',date:'2025-10-24 09:30',duration_min:15},
    {id:1007,name:'Calibrazione Sensori',date:'2025-10-24 11:00',duration_min:40},
    {id:1008,name:'Test Pioggia',date:'2025-10-23 16:20',duration_min:35},
    {id:1009,name:'Endurance Test',date:'2025-10-23 14:15',duration_min:120},
    {id:1010,name:'Setup Base',date:'2025-10-22 10:00',duration_min:50}
  ]);}
};

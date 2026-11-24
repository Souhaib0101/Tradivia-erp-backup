export const api=(path,options={})=>fetch(`${import.meta.env.VITE_API_URL??'http://localhost:3001/api'}${path}`,options);

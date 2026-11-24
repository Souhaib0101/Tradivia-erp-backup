export const notFound=(req,res)=>res.status(404).json({error:'Ressource introuvable.'});
export const errors=(error,req,res,next)=>res.status(error.status??500).json({error:error.message??'Erreur interne.'});

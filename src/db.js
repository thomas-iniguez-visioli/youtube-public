let uuid = require("uuid")
const fs = require("fs");
const path = require("path");

const app = require('electron').app;
const userDataPath = app.getPath('userData');
const databaseFilePath = path.join(userDataPath, 'database.json');
const regex = /\[(.*?)\]/;
const getid = (nam) => {
    let input = nam
    let regex = /\[(.*?)\]\.mp4$/;
    let matches = input.match(regex);
    console.log(matches)
    console.log(input)
    console.log(matches[0].split(",")[1])
    return matches[0].split(",")[1]

}
const ispresent = (item, array) => {
    let status = false
    for (let index = 0; index < array.length; index++) {
        const element = array[index];
        if (element.fileName === item.fileName) {
            status = true
        }
        
    }
    return status
}
const parser = (array) => {
    let retour = []
    for (let index = 0; index < array.length; index++) {
        const element = array[index];
        const data = element.split(":")
        if (!ispresent({
            fileName: data[0],
            fileUuid: data[1],
            yid: data[2]
        }, retour)) {
            let id = data[0].match(regex)
            retour.push({
                fileName: data[0],
                fileUuid: data[1],
                yid: data[2],
                tags: [] // Ajout d'un champ tags vide pour chaque entrée
            })
        }
       
    } return retour
}

module.exports =
class FileDatabase {
    // La fonction constructeur de la classe prend en paramètre le chemin du dossier contenant les fichiers
    constructor(directoryPath) {
        this.directoryPath = directoryPath;
        this.database = [];
        this.history = [];
        this.loadDatabase(); // Charge la base de données JSON au démarrage
        if (this.database.length === 0) {
            this.createDatabase(); // Crée la base de données si elle est vide
        }
    }
    search(query) {
       // Recherchez les entrées qui correspondent à la requête
       const results = this.database.filter((entry) => {
         return entry.fileName.toLowerCase()
         .includes(query.toLowerCase());
       }).filter((item)=>{return fs.existsSync(path.join(userDataPath, 'file',item.fileName))})
   
       return results;
     }
    readDatabase() {
        fs.readdirSync(this.directoryPath).forEach((item) => {
           if (!ispresent({
               fileName: item,
             
           }, this.database)) {
               if (item.endsWith(".mp4")) {
                   let id = item.match(regex)
                   console.log(id)
                   if (id) {
                       const infoPath = path.join(this.directoryPath, item.replace(".mp4", ".info.json"));
                       let displayId = id[1];
                       if (fs.existsSync(infoPath)) {
                           try {
                               const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
                               displayId = info.display_id || id[1];
                           } catch (e) {
                               console.error(`Error reading info file ${infoPath}:`, e);
                           }
                       }
                       this.database.push({
                           fileName: item,
                           fileUuid: `https://www.youtube.com/watch?v=${id[1]}`.replace(":",'_'), 
                           yid: displayId,
                           tags: [] // Ajout d'un champ tags vide pour chaque nouvelle entrée
                       })
                   }
               }
               
                
           }
           
        })
        console.log(this.database)
        this.saveDatabase(); // Sauvegarde la base de données JSON après chaque lecture
    }
    save() {
        let data = []
        if(this.database.length!==0){
            this.database=this.database.filter((item)=>{return fs.existsSync(path.join(userDataPath, 'file',item.fileName))})
        
        }
       this.database.map((item) => { data.push(`${item.fileName}:${item.fileUuid}:${item.yid}:${item.tags.join(",")}`) })
        this.saveDatabase();
    }
    getFile(uuid) {
        return this.database.filter(file => file.yid === uuid)[0]
    }

    // La méthode getUuids retourne la liste des UUID de tous les fichiers de la base de données
    getUuids() {
        // Initialisez une liste pour stocker les UUID
        const uuids = [];

        // Parcourez la base de données
        for (const fileData of this.database) {
            // Ajoutez le UUID de chaque fichier à la liste
            uuids.push(fileData.fileUuid);
        }

        // Retournez la liste des UUID
        return uuids;
    }

    // Charge la base de données JSON
    loadDatabase() {
        if (fs.existsSync(databaseFilePath)) {
            try {
                const data = JSON.parse(fs.readFileSync(databaseFilePath));
                this.database = data.database || data; // Fallback for old structure
                this.history = data.history || [];
            } catch (error) {
                console.error("Failed to parse database file:", error);
                //LogRocket.captureException(error);
                this.database = [];
                this.history = [];
            }
        }
    }

    // Sauvegarde la base de données JSON
    saveDatabase() {
        const dir = path.dirname(databaseFilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(databaseFilePath, JSON.stringify({
            database: this.database,
            history: this.history
        }));
    }

    // Crée la base de données si elle est vide
    createDatabase() {
        this.database = [];
        this.history = [];
        this.saveDatabase();
    }

    // Ajoute un tag à un fichier spécifié par son UUID
    addTag(uuid, tag) {
        const file = this.database.find(file => file.yid === uuid);
        if (file) {
            file.tags.push(tag);
            file.tags=[...new Set(file.tags)]
            this.saveDatabase(); // Sauvegarde la base de données après ajout d'un tag
        }
    }

    // Retirer un tag d'un fichier spécifié par son UUID
    removeTag(uuid, tag) {
        const file = this.database.find(file => file.yid === uuid);
        if (file) {
            file.tags = file.tags.filter(t => t !== tag);
            this.saveDatabase(); // Sauvegarde la base de données après retrait d'un tag
        }
    }

    // Récupère les fichiers qui ont un tag spécifique
    getByTag(tag) {
        return this.database.filter(file => file.tags.includes(tag));
    }

    addToHistory(videoId) {
        // Remove existing entry for this video if it exists
        this.history = this.history.filter(id => id !== videoId);
        // Add to the beginning of history
        this.history.unshift(videoId);
        // Limit history to 80% of the total number of videos
        const limit = Math.floor(this.database.length * 0.8);
        if (this.history.length > limit && limit > 0) {
            this.history.pop();
        }
        this.saveDatabase();
    }

    getHistory() {
        return this.history.map(id => this.getFile(id)).filter(file => !!file);
    }
}

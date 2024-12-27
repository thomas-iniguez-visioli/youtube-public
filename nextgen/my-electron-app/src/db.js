let uuid = require("uuid")
const fs = require("fs");
const path = require("path");
const app = require('electron').app;
const userDataPath = app.getPath('userData');
const parsedFilePath = path.join(userDataPath, 'parsed.txt');
const parse = fs.readFileSync(parsedFilePath).toString().split("\n")
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
                yid: data[2]
            })
        }
       
    } return retour
}

module.exports =
class FileDatabase {
    // La fonction constructeur de la classe prend en paramètre le chemin du dossier contenant les fichiers
    constructor(directoryPath) {
        this.directoryPath = directoryPath;
        this.database = parser(parse).filter((f) => f.fileName)

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
                       this.database.push({
                           fileName: item,
                           fileUuid: `https://www.youtube.com/watch?v=${id[1]}`.replace(":",'_'), yid: id[1]
                       })
                   }
               }
               
                
           }
           
        })
        console.log(this.database)
    }
    save() {
        let data = []
        if(this.database.length!==0){
            this.database=this.database.filter((item)=>{return fs.existsSync(path.join(userDataPath, 'file',item.fileName))})
        
        }
       this.database.map((item) => { data.push(`${item.fileName}:${item.fileUuid}:${item.yid}`) })
        fs.writeFileSync(parsedFilePath, data.join("\n"))
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
}

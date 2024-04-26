const fs = require('fs')
const path = require('path')

const folderPath = '.' // Path to the folder containing JSON files

fs.readdir(folderPath, (err, files) => {
  if (err) {
    return console.error('Failed to list directory', err)
  }

  files.forEach((file) => {
    if (path.extname(file) === '.json') {
      const filePath = path.join(folderPath, file)
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          console.error('Error reading file', file, err)
          return
        }

        const jsonData = JSON.parse(data)
        let isModified = false

        for (const key in jsonData) {
          const item = jsonData[key]
          if (
            item.cats &&
            item.cats.includes(51) &&
            (item.cats.includes(80) || item.cats.includes(87))
          ) {
            const index = item.cats.indexOf(51)
            if (index !== -1) {
              item.cats[index] = 114 // Replace 51 with 114
              isModified = true
            }
          }
        }

        if (isModified) {
          fs.writeFile(
            filePath,
            JSON.stringify(jsonData, null, 2),
            'utf8',
            (err) => {
              if (err) {
                console.error('Error writing file', file, err)
              } else {
                console.log(`Updated ${file} successfully.`)
              }
            }
          )
        }
      })
    }
  })
})

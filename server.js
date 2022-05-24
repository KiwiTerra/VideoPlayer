const fastify = require("fastify")();
const fs = require('fs')
const ffprobe = require('ffprobe');
const ffprobeStatic = require('ffprobe-static');
const path = require('path')
const dotenv = require('dotenv');
dotenv.config();

fastify.register(require("point-of-view"), {
  engine: {
    ejs: require("ejs"),
  },
});
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'data'),
  prefix: '/data/',
})
fastify.register(require('@fastify/cookie'));
fastify.register(require('@fastify/session'), {secret: process.env.SECRET_COOKIE, cookie: { secure: false }});
fastify.register(require('@fastify/formbody'))

fastify.post("/login", (req, reply) => {
  const password = req.body.password === process.env.PASSWORD;
  if(password) {
    req.session.auth = true
    reply.redirect('/') 
  } else {
    reply.redirect('/login')
  }
})

fastify.get("/login", (req, reply) => {
  if(req.session.auth === true)
    return reply.redirect('/');
  reply.view("/views/login.ejs", { text: "text" });
});

fastify.get("/*", async (req, reply) => {
  if(req.session.auth == null)
    return reply.redirect('/login')

  const folderName = decodeURI(req.url)

  const directories = getDirectories(getDataPath());
  directories.unshift('Dossier Principal')

  const files = await getFiles(path.join(getDataPath(), folderName))

  reply.view("/views/index.ejs", { directories, files, active: folderName.substring(1) });
});

fastify.get('/video', async (req, reply) => {
  if(req.session.auth == null)
    return reply.redirect('/login');

  if(req.query.path == null)
    return reply.redirect('/');

  const directories = getDirectories(getDataPath());
  directories.unshift('Dossier Principal');

  reply.view('/views/video.ejs', { directories, video: req.query.path });
})

fastify.listen(80, '0.0.0.0', (err) => {
  if (err) throw err;
  console.log(`server listening on ${fastify.server.address().port}`);
});

function getDirectories(path) {
  return fs.readdirSync(path).filter(function (file) {
    return fs.statSync(path+'/'+file).isDirectory();
  });
}

async function getFiles(path) {

  const files = [];
  for(const file of fs.readdirSync(path)) {
    const stats = fs.statSync(`${path}/${file}`);
    if(!stats.isFile() && !file.endsWith('.mp4'))
      continue;
    
    let seconds;
    try {
      const info = await ffprobe(path + '/' + file, { path: ffprobeStatic.path });
      seconds = info.streams.filter((e) => e.duration_ts > 0)[0].duration;
    } catch(e) {
      if(e)
        continue;
    }

    files.push({name: file, duration: new Date(seconds * 1000).toISOString().substring(11, 16), size: formatBytes(stats.size), created: stats.ctime, path: encodeURI(`${path.replace(getDataPath(), '')}/${file}`)})
  }

  return files;
}

// Found here
// https://stackoverflow.com/questions/15900485/correct-way-to-convert-size-in-bytes-to-kb-mb-gb-in-javascript
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function getDataPath() {
  return path.join(__dirname, 'data');
}
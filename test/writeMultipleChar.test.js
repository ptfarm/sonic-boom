'use strict'

const fs = require('fs')
const proxyquire = require('proxyquire')
const { file, runTests } = require('./helper')

runTests(buildTests)

function buildTests (test, sync) {
  // Reset the umask for testing
  process.umask(0o000)

  test('write multi-byte characters string over than maxWrite', (t) => {
    const fakeFs = Object.create(fs)
    const MAX_WRITE = 65535
    fakeFs.write = function (fd, buf, ...args) {
      // only write byteLength === MAX_WRITE
      const _buf = Buffer.from(buf).subarray(0, MAX_WRITE).toString()
      fs.write(fd, _buf, ...args)
      setImmediate(args[args.length - 1], null, MAX_WRITE)
      fakeFs.write = function (fd, buf, ...args) {
        fs.write(fd, buf, ...args)
      }
    }
    const SonicBoom = proxyquire('../', {
      fs: fakeFs
    })
    const dest = file()
    const fd = fs.openSync(dest, 'w')
    const stream = new SonicBoom({ fd, minLength: 0, sync, maxWrite: MAX_WRITE })
    let buf = Buffer.alloc(MAX_WRITE).fill('x')
    buf = '🌲' + buf.toString()
    stream.write(buf)
    stream.end()

    stream.on('finish', () => {
      fs.readFile(dest, 'utf8', (err, data) => {
        t.error(err)
        t.equal(data, buf)
        t.end()
      })
    })
    stream.on('close', () => {
      t.pass('close emitted')
    })
    stream.on('error', () => {
      t.pass('error emitted')
    })
  })
}

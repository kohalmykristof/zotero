Zotero Standalone Build - How to
======

Mainly based on https://www.zotero.org/support/dev/client_coding/building_the_standalone_client

# 1. Get repositories

## 1.1. https://github.com/kohalmykristof/zotero

Zotero core. Clone to your work folder and checkout branch 4.0

## 1.2. https://github.com/kohalmykristof/zotero-build

Zotero build repository. Modified build scripts.

Clone to your work folder also.

## 1.3. https://github.com/zotero/zotero-standalone-build

Zotero standalone build repository. Original from zotero's github. Clone to your work folder also.

# 2. checking requirements

In your work folder, change to zotero-standalone-build repository's (see 1.3.) folder:

```shell
cd zotero-standalone-build
```

Then call check requirement script:

```shell
scripts/check_requirements
```

You'll need build requirements only, distribution requirements aren't neccessary.

# 2.1. further requirements

On my Ubuntu 16.04., I had to install 7zip CLI

```shell
sudo apt-get install p7zip
sudo apt-get install p7zip-full
```

(xulrunner fetch script will use 7z command in case of Windows build)

# 3. Fetch and modifiy Mozilla Firefox's runtime files xulrunner into zotero-standalone-build/xulrunner directory

```shell
./fetch_xulrunner.sh -p w
./fetch_xulrunner.sh -p l
```

These commands will fetch Firefox's runtime files for Windows and Linux platform. We don't support any MAC platform builds. If it is also required, further dependencies needed also.

# 4. Build XPI from Zotero source

XPI building from Zotero Core in your work folder's zotero subdirectory (see 1.1.).

You can do this build in zotero-build repository's xpi subfolder (see 1.2.).

```shell
cd ../zotero-build/xpi
```

You'll have to use build_xpi_4.0 script with next parameters:

| # | parameter | value | description |
|---|-----------|-------|-------------|
| 1 | branch | 4.0 | zotero core's branch |
| 2 | channel | e.g. 'release' | strips revision number and build info. It can be 'beta' also. |
| 3 | XPI suffix | 4.0.29.17.FETI | suffix of XPI to reference in update.rdf, defaults to "build" |
| 4 | RDF suffix | leave blank | suffix of update RDF file to reference in install.rdf, leave blank to leave as 'update.rdf' |
| 5 | XPI dir | leave blank | extra directory to point to when referencing the XPI and update RDF, defaults to blank (i.e. zotero.org/download/update*.rdf) |
| 6 | Build suffix | leave blank | default: 'build' |

Run command:
```shell
./build_xpi_4.0 4.0 release 4.0.29.17.FETI
```

Build script will clone zotero core repository from GitHub recursively and it will checkout to specified branch.

If everything goes well, you'll get:
- an XPI build in zotero-build/xpi/build/zotero folder
- a zipped archive in zotero-build/xpi/build (zotero-build.xpi)
- an update-build.rdf in zotero-build/xpi/build with feti.hu url (similar to update.rdf in zotero core repository).

Note: versioning in core need a concatenated '.SOURCE' which is stripped in XPI build. Versioning in zotero/install.rdf and zotero/update.rdf is '4.0.29.17.FETI.SOURCE'.

If you need to revert, delete everything in zotero-build/xpi/build folder except .gitignore file.

Note: further developments - use this built XPI file to create signed Mozilla Add-On available in addons.mozilla.org (AMO).

Zotero
======
[![Build Status](https://travis-ci.org/zotero/zotero.svg?branch=4.0)](https://travis-ci.org/zotero/zotero)

[Zotero](https://www.zotero.org/) is a free, easy-to-use tool to help you collect, organize, cite, and share your research sources.

Please post feature requests or bug reports to the [Zotero Forums](https://forums.zotero.org/). If you're having trouble with Zotero, see [Getting Help](https://www.zotero.org/support/getting_help).

For more information on how to use this source code, see the [Zotero wiki](https://www.zotero.org/support/dev/source_code).

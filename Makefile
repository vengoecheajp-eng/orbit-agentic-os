.PHONY: setup check test

setup:
	npm install

check:
	node --check server.mjs
	npm run build

test:
	npm test

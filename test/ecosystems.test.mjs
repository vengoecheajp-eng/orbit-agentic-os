import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ECOSYSTEMS, classifyPath, detectProjects, diffParsed, makefileChecks, rawDiff, registryLookup, stepLabel } from '../ecosystems.mjs';

const parse = (path, text) => classifyPath(path).parse(text);
const names = parsed => parsed.entries.map(entry => `${entry.section}|${entry.name}|${entry.spec}|${entry.source}`);

describe('manifest parsers', () => {
  it('reads requirements files, including index options and direct URLs', () => {
    const parsed = parse('requirements.txt', 'requests[socks]>=2.31 ; python_version > "3.8"\nDjango==5.0  # web\n--extra-index-url https://pypi.internal/simple\n-e git+https://github.com/a/b.git#egg=b\nmylib @ https://example.invalid/mylib.whl\n-r base.txt\nflask \\\n  >=3\n');
    expect(names(parsed)).toEqual([
      'dependencies|requests|[socks]>=2.31 ; python_version > "3.8"|registry',
      'dependencies|Django|==5.0|registry',
      'index|--extra-index-url|https://pypi.internal/simple|url',
      'editable|git+https://github.com/a/b.git#egg=b|git+https://github.com/a/b.git#egg=b|git',
      'dependencies|mylib|@ https://example.invalid/mylib.whl|url',
      'dependencies|flask|>=3|registry'
    ]);
  });

  it('reads pyproject.toml (PEP 621, build requirements, uv sources and indexes, Poetry)', () => {
    const pep621 = parse('pyproject.toml', '[build-system]\nrequires=["setuptools>=61"]\n[project]\nname="x"\ndependencies=["httpx>=0.27"]\n[project.optional-dependencies]\ndev=["pytest"]\n[tool.uv.sources]\nmylib={git="https://github.com/a/mylib"}\n[[tool.uv.index]]\nname="corp"\nurl="https://pypi.corp/simple"\n');
    expect(names(pep621)).toEqual([
      'dependencies|httpx|>=0.27|registry',
      'optional:dev|pytest|*|registry',
      'build|setuptools|>=61|registry',
      'source override|mylib|https://github.com/a/mylib|git',
      'index|corp|https://pypi.corp/simple|url'
    ]);
    const poetry = parse('pyproject.toml', '[tool.poetry.dependencies]\npython="^3.11"\nrequests="^2.32"\nlocal={path="../local"}\n[tool.poetry.group.dev.dependencies]\npytest="^8"\n');
    expect(names(poetry)).toEqual(['dependencies|requests|^2.32|registry', 'dependencies|local|../local|local', 'group:dev|pytest|^8|registry']);
  });

  it('reads Cargo.toml, including [patch] overrides', () => {
    const parsed = parse('Cargo.toml', '[dependencies]\nserde={version="1"}\ntokio="1.38"\nmine={path="../mine"}\n[patch.crates-io]\nserde={git="https://example.invalid/serde"}\n');
    expect(names(parsed)).toEqual(['dependencies|serde|1|registry', 'dependencies|tokio|1.38|registry', 'dependencies|mine|../mine|local', 'patch crates-io|serde|https://example.invalid/serde|git']);
    // A crate is the same dependency whether written as a string or a table.
    const before = parse('Cargo.toml', '[dependencies]\ntokio="1.38"\n');
    const after = parse('Cargo.toml', '[dependencies]\ntokio={version="1.38",features=["full"]}\n');
    expect(diffParsed(before, after)).toEqual({ added: [], changed: [], scripts: [] });
  });

  it('reads go.mod require, indirect, and replace directives', () => {
    const parsed = parse('go.mod', 'module x\n\ngo 1.22\n\nrequire (\n\tgithub.com/gin-gonic/gin v1.10.0\n\tgolang.org/x/net v0.25.0 // indirect\n)\nrequire github.com/stretchr/testify v1.9.0\nreplace github.com/foo/bar => ../bar\n');
    expect(names(parsed)).toEqual(['require|github.com/gin-gonic/gin|v1.10.0|registry', 'indirect|golang.org/x/net|v0.25.0|registry', 'require|github.com/stretchr/testify|v1.9.0|registry', 'replace|github.com/foo/bar|../bar|local']);
  });

  it('reads Gemfile gems, groups, git sources, and sources', () => {
    const parsed = parse('Gemfile', 'source "https://rubygems.org"\ngem "rails", "~> 7.1"\ngem "mylib", git: "https://example.invalid/mylib"\ngroup :development, :test do\n  gem "rspec-rails"\nend\n');
    expect(names(parsed)).toEqual(['index|https://rubygems.org|https://rubygems.org|url', 'dependencies|rails|~> 7.1|registry', 'dependencies|mylib|git: https://example.invalid/mylib|git', 'group development,test|rspec-rails|*|registry']);
  });

  it('reads composer.json packages, repositories, plugin permissions, and install scripts', () => {
    const parsed = parse('composer.json', JSON.stringify({ require: { php: '>=8.2', 'ext-json': '*', 'laravel/framework': '^11.0' }, repositories: [{ type: 'vcs', url: 'https://example.invalid/r' }], scripts: { 'post-install-cmd': ['@php artisan x'], test: 'phpunit' }, config: { 'allow-plugins': { 'php-http/discovery': true } } }));
    expect(names(parsed)).toEqual(['require|laravel/framework|^11.0|registry', 'repository|https://example.invalid/r|vcs https://example.invalid/r|git', 'plugin permission|php-http/discovery|allowed|registry']);
    expect(parsed.scripts).toEqual({ 'post-install-cmd': '["@php artisan x"]' });
  });

  it('reads .NET, Maven, Gradle, version catalogs, pubspec, SwiftPM, and Mix', () => {
    expect(names(parse('App.csproj', '<Project><ItemGroup><PackageReference Include="Newtonsoft.Json" Version="13.0.3" /><PackageReference Include="Serilog"><Version>4.0.0</Version></PackageReference></ItemGroup></Project>'))).toEqual(['dependencies|Newtonsoft.Json|13.0.3|registry', 'dependencies|Serilog|4.0.0|registry']);
    expect(names(parse('pom.xml', '<project><dependencies><dependency><groupId>junit</groupId><artifactId>junit</artifactId><version>4.13.2</version><scope>test</scope></dependency></dependencies><repositories><repository><url>https://repo.corp/maven</url></repository></repositories></project>'))).toEqual(['dependencies (test)|junit:junit|4.13.2|registry', 'repository|https://repo.corp/maven|https://repo.corp/maven|url']);
    expect(names(parse('app/build.gradle.kts', 'plugins { id("org.springframework.boot") version "3.3.0" }\nrepositories { maven("https://jitpack.io") }\ndependencies {\n  implementation("com.squareup.okhttp3:okhttp:4.12.0") // http\n}\n'))).toEqual(['implementation|com.squareup.okhttp3:okhttp|4.12.0|registry', 'plugin|org.springframework.boot|3.3.0|registry', 'repository|https://jitpack.io|https://jitpack.io|url']);
    expect(names(parse('gradle/libs.versions.toml', '[versions]\nokhttp="4.12.0"\n[libraries]\nokhttp={module="com.squareup.okhttp3:okhttp",version.ref="okhttp"}\n'))).toEqual(['library|com.squareup.okhttp3:okhttp|4.12.0|registry']);
    expect(names(parse('pubspec.yaml', 'name: x\ndependencies:\n  flutter:\n    sdk: flutter\n  http: ^1.2.0\n  mine:\n    path: ../mine\n'))).toEqual(['dependencies|http|^1.2.0|registry', 'dependencies|mine|../mine|local']);
    expect(names(parse('Package.swift', 'dependencies: [.package(url: "https://github.com/apple/swift-argument-parser.git", from: "1.3.0")]'))).toEqual(['dependencies|apple/swift-argument-parser|from: "1.3.0" (https://github.com/apple/swift-argument-parser.git)|git']);
    expect(names(parse('mix.exs', 'defp deps do\n [{:phoenix, "~> 1.7"}, {:ex_doc, "~> 0.31", only: :dev}, {:mine, path: "../mine"}]\nend'))).toEqual(['deps|phoenix|~> 1.7|registry', 'only dev|ex_doc|~> 0.31|registry', 'deps|mine|path: ../mine|local']);
  });
});

describe('what the gate reviews', () => {
  it('classifies manifests, lockfiles, registry settings, and ignores installed folders', () => {
    const kind = path => { const info = classifyPath(path); return info && `${info.ecosystem}:${info.kind}`; };
    expect(kind('package-lock.json')).toBe('npm:lockfile');
    expect(kind('services/api/go.sum')).toBe('go:lockfile');
    expect(kind('.npmrc')).toBe('npm:config');
    expect(kind('gradle/wrapper/gradle-wrapper.properties')).toBe('gradle:config');
    expect(kind('setup.py')).toBe('python:raw');
    expect(kind('requirements/dev.txt')).toBe('python:manifest');
    expect(kind('Directory.Packages.props')).toBe('nuget:manifest');
    expect(kind('node_modules/x/package.json')).toBe(null);
    expect(kind('src/index.js')).toBe(null);
  });

  it('summarises raw text changes line by line', () => {
    expect(rawDiff('a\nb\n', 'a\nc\nd\n')).toEqual({ added: 2, removed: 1, preview: ['+ c', '+ d', '- b'] });
    expect(rawDiff(null, 'x\n').added).toBe(1);
  });

  it('looks packages up on the right registry', () => {
    expect(registryLookup('python', { name: 'Django_REST', source: 'registry', section: 'dependencies' }).url).toBe('https://pypi.org/pypi/django-rest/json');
    expect(registryLookup('go', { name: 'github.com/BurntSushi/toml', source: 'registry', section: 'require' }).url).toBe('https://proxy.golang.org/github.com/!burnt!sushi/toml/@latest');
    expect(registryLookup('gradle', { name: 'androidx.core:core-ktx', source: 'registry', section: 'implementation' }).url).toContain('dl.google.com');
    expect(registryLookup('maven', { name: 'junit:junit', source: 'registry', section: 'dependencies (test)' }).url).toBe('https://repo1.maven.org/maven2/junit/junit/maven-metadata.xml');
    expect(registryLookup('npm', { name: 'sw', spec: 'npm:string-width@^4', source: 'alias', section: 'dependencies' }, { npmRegistry: 'https://npm.corp/' }).url).toBe('https://npm.corp/string-width/latest');
    // Non-registry sources and index settings are never looked up.
    expect(registryLookup('python', { name: 'x', source: 'git', section: 'dependencies' })).toBe(null);
    expect(registryLookup('python', { name: 'corp', source: 'registry', section: 'index' })).toBe(null);
  });
});

describe('install and check commands', () => {
  let directory;
  afterEach(() => { if (directory) rmSync(directory, { recursive: true, force: true }); directory = null; });
  const project = files => {
    directory = mkdtempSync(join(tmpdir(), 'orbit-eco-'));
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(join(directory, path, '..'), { recursive: true });
      writeFileSync(join(directory, path), content);
    }
    return directory;
  };
  const labels = steps => steps.map(stepLabel);

  it('offers a script-free install for every package manager that supports one', () => {
    expect(labels(ECOSYSTEMS.npm.install(project({ 'package.json': '{}', 'package-lock.json': '{}' }), 'update', { ignoreScripts: true }))).toEqual(['npm install --no-audit --no-fund --ignore-scripts']);
    rmSync(directory, { recursive: true, force: true });
    expect(labels(ECOSYSTEMS.composer.install(project({ 'composer.json': '{}', 'composer.lock': '{}' }), 'update', { ignoreScripts: true }))).toEqual(['composer update --no-interaction --no-progress --no-scripts --no-plugins']);
    rmSync(directory, { recursive: true, force: true });
    expect(labels(ECOSYSTEMS.python.install(project({ 'requirements.txt': 'x' }), 'update', { ignoreScripts: true }))).toEqual(['python3 -m venv .venv', `${join('.venv', 'bin', 'python')} -m pip install --disable-pip-version-check -q --only-binary :all: -r requirements.txt`]);
  });

  it('uses the Python tool the project already uses', () => {
    expect(labels(ECOSYSTEMS.python.install(project({ 'pyproject.toml': '[project]\nname="x"', 'uv.lock': '' }), 'frozen'))).toEqual(['uv sync --frozen']);
    rmSync(directory, { recursive: true, force: true });
    expect(labels(ECOSYSTEMS.python.install(project({ 'pyproject.toml': '[tool.poetry]\nname="x"' }), 'update'))).toEqual(['poetry lock', 'poetry install --no-root --no-interaction']);
  });

  it('builds and tests each project with its own toolchain', () => {
    expect(labels(ECOSYSTEMS.npm.checks(project({ 'package.json': JSON.stringify({ scripts: { build: 'vite build', test: 'vitest' } }), 'pnpm-lock.yaml': '' })))).toEqual(['pnpm run build', 'pnpm run test --run']);
    rmSync(directory, { recursive: true, force: true });
    expect(labels(ECOSYSTEMS.go.checks(project({ 'go.mod': 'module x' })))).toEqual(['go build ./...', 'go test ./...']);
    rmSync(directory, { recursive: true, force: true });
    expect(labels(ECOSYSTEMS.gradle.checks(project({ 'build.gradle': '', gradlew: '' })))).toEqual(['./gradlew --no-daemon -q assemble', './gradlew --no-daemon -q test']);
    rmSync(directory, { recursive: true, force: true });
    expect(labels(makefileChecks(project({ Makefile: 'build:\n\tcc x.c\ntest:\n\t./t\n' })))).toEqual(['make build', 'make test']);
  });

  it('finds every project in a monorepo but not the subprojects of one build', () => {
    const root = project({
      'web/package.json': '{}',
      'api/pyproject.toml': '[project]\nname="api"',
      'services/billing/go.mod': 'module billing',
      'settings.gradle': '',
      'app/build.gradle': ''
    });
    const found = detectProjects(root).map(item => `${item.ecosystem}:${item.directory.slice(root.length + 1) || '.'}`).sort();
    expect(found).toEqual(['go:services/billing', 'gradle:.', 'npm:web', 'python:api']);
  });
});

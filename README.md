# shipit-bot

A GitHub App that validates code reviews, as defined by one or more potentially overlapping `.acl` files

ACL files must be placed in the `/acl` folder of a project, must have an `.acl` or `.acl.<N>` extension (where `<N>` is a positive integer), and should have YAML content like this

```yaml
owners: [mike-north]
paths: docs/*
```

In this example, the user [@mike-north](https://github.com/mike-north) would have to review and accept any code changes that touch files in the project's `/docs` folder

## Usage

## Development Setup

The following instructions describe the process of setting up this project for local development

To ensure that you use the versions of [`node`](https://nodejs.org) and [`yarn`](https://yarnpkg.com/) that this project supports, we recommend installing [`volta`](https://volta.sh/) globally.

Create a webhook proxy URL to use in development, by going to https://smee.io/new. It'll look like `https://smee.io/abcdefghijk`.

Next, create a `.env` dotfile by starting with the sample `.env.example` file

```sh
cp .env.example .env
```

and then open up the `.env` file to fill in your webhook URL

```sh
WEBHOOK_PROXY_URL=https://smee.io/abcdefghijk
```

Next, install this project's dependencies

```sh
yarn
```

and run the bot locally. Everything in the `/src` folder will be recompiled on file changes, and the app will be restarted

```sh
yarn watch
```

You should see an indication in your console that the app has started up on `http://localhost:3000`, and is using your webhook proxy

```
Listening on http://localhost:3000
Connected https://smee.io/abcdefghijk
```

Now, go to http://localhost:3000

## Contributing

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## License

[BSD-2-Clause](LICENSE) © 2019 LinkedIn

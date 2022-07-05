import {t} from "@b9g/crank/template.js";
import {renderer} from "@b9g/crank/html.js";
import type {Children, Element} from "@b9g/crank/crank.js";

import fs from "fs-extra";
import * as path from "path";

// TODO: lazily import these?
import "prismjs";
import "prismjs/components/prism-javascript.js";
import "prismjs/components/prism-jsx.js";
import "prismjs/components/prism-typescript.js";
import "prismjs/components/prism-tsx.js";
import "prismjs/components/prism-diff.js";
import "prismjs/components/prism-bash.js";

import {router} from "./routes.js";
import {collectDocuments} from "./models/document.js";
import type {DocInfo} from "./models/document.js";

import {Marked} from "./components/marked.js";
import {components} from "./components/marked-components.js";
import {Sidebar} from "./components/navigation.js";
import {Storage} from "./components/esbuild.js";
import {Root} from "./components/root.js";

const __dirname = new URL(".", import.meta.url).pathname;
const storage = new Storage({
	dirname: __dirname,
	staticPaths: [path.join(__dirname, "../static")],
});

const dist = path.join(__dirname, "../dist");
await fs.emptyDir(dist);
await fs.ensureDir(dist);

// TODO: Route this through the server or whatever
import Home from "./views/home.js";
{
	// HOMEPAGE
	await fs.writeFile(
		path.join(dist, "index.html"),
		await renderer.render(t`<${Home} storage=${storage} />`),
	);
}

import Guide from "./views/guide.js";

{
	// GUIDES
	const docs = await collectDocuments(
		path.join(__dirname, "../documents/guides"),
		path.join(__dirname, "../documents/"),
	);

	await Promise.all(
		docs.map(async (post) => {
			const {
				attributes: {publish},
				url,
			} = post;
			if (!publish) {
				return;
			}

			const match = router.match(url);
			if (!match) {
				return;
			}

			const html = await renderer.render(t`
				<${Guide} url=${url} storage=${storage} params=${match.params} />
			`);

			const filename = path.join(dist, url + ".html");
			await fs.ensureDir(path.dirname(filename));
			await fs.writeFile(filename, html);
		}),
	);
}

import BlogHome from "./views/blog-home.js";
{
	const html = await renderer.render(t`
		<${BlogHome} storage=${storage} />
	`);

	await fs.ensureDir(path.join(dist, "blog"));
	await fs.writeFile(path.join(dist, "blog/index.html"), html);
}

import {BlogContent} from "./components/blog-content.js";

interface BlogPageProps {
	title: string;
	url: string;
	publishDate?: Date;
	docs: Array<DocInfo>;
	children: Children;
}

function BlogPage({
	title,
	docs,
	children,
	publishDate,
	url,
}: BlogPageProps): Element {
	return t`
		<${Root} title="Crank.js | ${title}" url=${url} storage=${storage}>
			<${Sidebar} docs=${docs} url=${url} title="Recent Posts" />
			<main class="main">
				<div class="content">
					<${BlogContent} title=${title} publishDate=${publishDate}>
						${children}
					<//BlogContent>
				</div>
			</main>
		<//Root>
	`;
}

{
	// BLOG POSTS
	const posts = await collectDocuments(
		path.join(__dirname, "../documents/blog"),
		path.join(__dirname, "../documents/"),
	);
	posts.reverse();
	await Promise.all(
		posts.map(async (post) => {
			const {
				attributes: {title, publish, publishDate},
				url,
				body,
			} = post;
			if (!publish) {
				return;
			}

			const filename = path.join(dist, url + ".html");
			await fs.ensureDir(path.dirname(filename));
			const html = await renderer.render(t`
				<${BlogPage}
					title=${title}
					docs=${posts}
					url=${url}
					publishDate=${publishDate}
				>
					<${Marked} markdown=${body} components=${components} />
				<//BlogPage>
			`);
			await fs.writeFile(filename, html);
		}),
	);
}

await storage.write(path.join(dist, "/static/"));
storage.clear();
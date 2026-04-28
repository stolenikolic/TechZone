import { NextResponse } from "next/server";
import type Blog from "models/Blog.model";

const ARTICLES: Blog[] = [
  {
    id: "article-1",
    slug: "coastal-charm-a-lone-seagull-s-morning",
    title: "Coastal Charm: A Lone Seagull's Morning",
    createdAt: "21 SEP",
    thumbnail: "/assets/images/blogs/blog-1.jpg",
    description: "Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Phasellus hendrerit.…"
  },
  {
    id: "article-2",
    slug: "serenity-on-the-water",
    title: "Serenity on the Water: A Glimpse into Nature's Calm",
    createdAt: "21 SEP",
    thumbnail: "/assets/images/blogs/blog-2.jpg",
    description: "Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Phasellus hendrerit.…"
  },
  {
    id: "article-3",
    slug: "tech-tips-and-tricks",
    title: "Tech Tips and Tricks for Everyday Use",
    createdAt: "20 SEP",
    thumbnail: "/assets/images/blogs/blog-1.jpg",
    description: "Discover the latest tips to get the most out of your devices."
  }
];

export async function GET() {
  return NextResponse.json(ARTICLES);
}

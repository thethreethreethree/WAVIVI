import { photo } from "@/lib/travejor/photo";

/** A post in the vertical Travelers Feed. */
export interface FeedPost {
  id: string;
  handle: string;
  verified: boolean;
  caption: string;
  location: string;
  image: string;
  likes: string;
  comments: number;
  shares: number;
}

export const feedPosts: FeedPost[] = [
  {
    id: "santorini",
    handle: "NomadicLena",
    verified: true,
    caption: "Lost in the magic of Santorini's blue domes and endless sunsets 🏖️",
    location: "Santorini, Greece",
    image: photo("feed-santorini", 900, 1600),
    likes: "2.4K",
    comments: 156,
    shares: 89,
  },
  {
    id: "kyoto",
    handle: "WanderWithKai",
    verified: true,
    caption: "Bamboo forest mornings hit different when you beat the crowds 🎋",
    location: "Arashiyama, Kyoto",
    image: photo("feed-kyoto", 900, 1600),
    likes: "5.1K",
    comments: 302,
    shares: 144,
  },
  {
    id: "marrakech",
    handle: "SoukSeeker",
    verified: false,
    caption: "Got delightfully lost in the medina. Bought three rugs I don't need 🧶",
    location: "Marrakech, Morocco",
    image: photo("feed-marrakech", 900, 1600),
    likes: "1.8K",
    comments: 97,
    shares: 41,
  },
  {
    id: "patagonia",
    handle: "TrailDust",
    verified: true,
    caption: "Five days on the W trek. My legs are gone but my soul is full ⛰️",
    location: "Torres del Paine, Chile",
    image: photo("feed-patagonia", 900, 1600),
    likes: "8.7K",
    comments: 511,
    shares: 230,
  },
];

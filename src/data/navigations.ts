import { CategoryMenuItem } from "models/Category.model";

export const categoryMenus: CategoryMenuItem[] = [
  {
    icon: "ShirtLine",
    title: "Fashion",
    href: "/fashion",
    component: "Grid",
    offer: { url: "/assets/images/promotion/offer-1.png", href: "/products/search", position: "right" },
    children: [
      {
        title: "Man Clothes",
        href: "#",
        children: [
          { title: "Shirt", href: "/products/search?category=clothes" },
          { title: "T- shirt", href: "/products/search?category=clothes" },
          { title: "Pant", href: "/products/search?category=clothes" },
          { title: "Underwear", href: "/products/search?category=clothes" }
        ]
      },
      {
        title: "Accessories",
        href: "#",
        children: [
          { title: "Belt", href: "/products/search?category=clothes" },
          { title: "Hat", href: "/products/search?category=clothes" },
          { title: "Watches", href: "/products/search?category=clothes" },
          { title: "Sunglasses", href: "/products/search?category=clothes" }
        ]
      },
      {
        title: "Shoes",
        href: "#",
        children: [
          { title: "Sneakers", href: "/products/search?category=clothes" },
          { title: "Sandals", href: "/products/search?category=clothes" },
          { title: "Formal", href: "/products/search?category=clothes" },
          { title: "Casual", href: "/products/search?category=clothes" }
        ]
      },
      {
        title: "Bags",
        href: "#",
        children: [
          { title: "Backpack", href: "/products/search?category=clothes" },
          { title: "Crossbody Bags", href: "/products/search?category=clothes" },
          { title: "Side Bags", href: "/products/search?category=clothes" },
          { title: "Slides", href: "/products/search?category=clothes" }
        ]
      },
      {
        title: "Woman Clothes",
        href: "#",
        children: [
          { title: "Shirt", href: "/products/search?category=clothes" },
          { title: "T- shirt", href: "/products/search?category=clothes" },
          { title: "Pant", href: "/products/search?category=clothes" },
          { title: "Underwear", href: "/products/search?category=clothes" }
        ]
      },
      {
        title: "Accessories",
        href: "#",
        children: [
          { title: "Belt", href: "/products/search?category=clothes" },
          { title: "Hat", href: "/products/search?category=clothes" },
          { title: "Watches", href: "/products/search?category=clothes" },
          { title: "Sunglasses", href: "/products/search?category=clothes" }
        ]
      },
      {
        title: "Shoes",
        href: "#",
        children: [
          { title: "Sneakers", href: "/products/search?category=clothes" },
          { title: "Sandals", href: "/products/search?category=clothes" },
          { title: "Formal", href: "/products/search?category=clothes" },
          { title: "Casual", href: "/products/search?category=clothes" }
        ]
      },
      {
        title: "Bags",
        href: "#",
        children: [
          { title: "Backpack", href: "/products/search?category=clothes" },
          { title: "Crossbody Bags", href: "/products/search?category=clothes" },
          { title: "Side Bags", href: "/products/search?category=clothes" },
          { title: "Slides", href: "/products/search?category=clothes" }
        ]
      }
    ]
  },
  {
    icon: "Microchip",
    title: "Electronics",
    component: "Grid",
    href: "/electronics",
    offer: { url: "/assets/images/promotion/offer-5.png", href: "/", position: "bottom" },
    children: [
      {
        title: "Man Clothes",
        href: "#",
        children: [
          { title: "Shirt", href: "/products/search?category=clothes" },
          { title: "T- shirt", href: "/products/search?category=t-clothes" },
          { title: "Pant", href: "/products/search?category=clothes" },
          { title: "Underwear", href: "/products/search?category=clothes" }
        ]
      },
      {
        title: "Accessories",
        href: "#",
        children: [
          { title: "Belt", href: "/products/search?category=clothes" },
          { title: "Hat", href: "/products/search?category=clothes" },
          { title: "Watches", href: "/products/search?category=clothes" },
          { title: "Sunglasses", href: "/products/search?category=clothes" }
        ]
      },
      {
        title: "Shoes",
        href: "#",
        children: [
          { title: "Sneakers", href: "/products/search?category=clothes" },
          { title: "Sandals", href: "/products/search?category=clothes" },
          { title: "Formal", href: "/products/search?category=clothes" },
          { title: "Casual", href: "/products/search?category=clothes" }
        ]
      },
      {
        title: "Bags",
        href: "#",
        children: [
          { title: "Backpack", href: "/products/search?category=clothes" },
          { title: "Crossbody Bags", href: "/products/search?category=clothes" },
          { title: "Side Bags", href: "/products/search?category=clothes" },
          { title: "Slides", href: "/products/search?category=clothes" }
        ]
      },
      {
        title: "Woman Clothes",
        href: "#",
        children: [
          { title: "Shirt", href: "/products/search?category=clothes" },
          { title: "T- shirt", href: "/products/search?category=clothes" },
          { title: "Pant", href: "/products/search?category=clothes" },
          { title: "Underwear", href: "/products/search?category=clothes" }
        ]
      },
      {
        title: "Accessories",
        href: "#",
        children: [
          { title: "Belt", href: "/products/search?category=clothes" },
          { title: "Hat", href: "/products/search?category=clothes" },
          { title: "Watches", href: "/products/search?category=clothes" },
          { title: "Sunglasses", href: "/products/search?category=clothes" }
        ]
      },
      {
        title: "Shoes",
        href: "#",
        children: [
          { title: "Sneakers", href: "/products/search?category=clothes" },
          { title: "Sandals", href: "/products/search?category=clothes" },
          { title: "Formal", href: "/products/search?category=clothes" },
          { title: "Casual", href: "/products/search?category=clothes" }
        ]
      },
      {
        title: "Bags",
        href: "#",
        children: [
          { title: "Backpack", href: "/products/search?category=clothes" },
          { title: "Crossbody Bags", href: "/products/search?category=clothes" },
          { title: "Side Bags", href: "/products/search?category=clothes" },
          { title: "Slides", href: "/products/search?category=clothes" }
        ]
      }
    ]
  },
  {
    icon: "PersonBiking",
    title: "Bikes",
    href: "/bikes",
    component: "List",
    children: [
      {
        icon: "ShirtLine",
        title: "Man",
        href: "#",
        component: "Grid",
        children: [
          {
            title: "Man Clothes",
            href: "#",
            children: [
              { title: "Shirt", href: "/products/search?category=clothes" },
              { title: "T- shirt", href: "/products/search?category=clothes" },
              { title: "Pant", href: "/products/search?category=clothes" },
              { title: "Underwear", href: "/products/search?category=clothes" }
            ]
          },
          {
            title: "Accessories",
            href: "#",
            children: [
              { title: "Belt", href: "/products/search?category=clothes" },
              { title: "Hat", href: "/products/search?category=clothes" },
              { title: "Watches", href: "/products/search?category=clothes" },
              { title: "Sunglasses", href: "/products/search?category=clothes" }
            ]
          },
          {
            title: "Shoes",
            href: "#",
            children: [
              { title: "Sneakers", href: "/products/search?category=clothes" },
              { title: "Sandals", href: "/products/search?category=clothes" },
              { title: "Formal", href: "/products/search?category=clothes" },
              { title: "Casual", href: "/products/search?category=clothes" }
            ]
          },
          {
            title: "Bags",
            href: "#",
            children: [
              { title: "Backpack", href: "/products/search?category=clothes" },
              { title: "Crossbody Bags", href: "/products/search?category=clothes" },
              { title: "Side Bags", href: "/products/search?category=clothes" },
              { title: "Slides", href: "/products/search?category=clothes" }
            ]
          }
        ]
      },
      {
        icon: "Woman",
        title: "Woman",
        href: "/products/search?category=clothes"
      },
      {
        icon: "BabyBoy",
        title: "Baby Boy",
        href: "/products/search?category=clothes"
      },
      {
        icon: "BabyGirl",
        title: "Baby Girl",
        href: "/products/search?category=clothes"
      }
    ]
  },
  {
    icon: "Trees",
    title: "Home & Garden",
    href: "/home-garden",
    component: "Grid",
    children: [
      {
        title: "Man Clothes",
        href: "#",
        children: [
          { title: "Shirt", href: "/products/search?category=clothes" },
          { title: "T- shirt", href: "/products/search?category=t-clothes" },
          { title: "Pant", href: "/products/search?category=clothes" },
          { title: "Underwear", href: "/products/search?category=clothes" }
        ]
      },
      {
        title: "Accessories",
        href: "#",
        children: [
          { title: "Belt", href: "/products/search?category=clothes" },
          { title: "Hat", href: "/products/search?category=clothes" },
          { title: "Watches", href: "/products/search?category=clothes" },
          { title: "Sunglasses", href: "/products/search?category=clothes" }
        ]
      },
      {
        title: "Shoes",
        href: "#",
        children: [
          { title: "Sneakers", href: "/products/search?category=clothes" },
          { title: "Sandals", href: "/products/search?category=clothes" },
          { title: "Formal", href: "/products/search?category=clothes" },
          { title: "Casual", href: "/products/search?category=clothes" }
        ]
      },
      {
        title: "Bags",
        href: "#",
        children: [
          { title: "Backpack", href: "/products/search?category=clothes" },
          { title: "Crossbody Bags", href: "/products/search?category=clothes" },
          { title: "Side Bags", href: "/products/search?category=clothes" },
          { title: "Slides", href: "/products/search?category=clothes" }
        ]
      },
      {
        title: "Woman Clothes",
        href: "#",
        children: [
          { title: "Shirt", href: "/products/search?category=clothes" },
          { title: "T- shirt", href: "/products/search?category=clothes" },
          { title: "Pant", href: "/products/search?category=clothes" },
          { title: "Underwear", href: "/products/search?category=clothes" }
        ]
      },
      {
        title: "Accessories",
        href: "#",
        children: [
          { title: "Belt", href: "/products/search?category=clothes" },
          { title: "Hat", href: "/products/search?category=clothes" },
          { title: "Watches", href: "/products/search?category=clothes" },
          { title: "Sunglasses", href: "/products/search?category=clothes" }
        ]
      },
      {
        title: "Shoes",
        href: "#",
        children: [
          { title: "Sneakers", href: "/products/search?category=clothes" },
          { title: "Sandals", href: "/products/search?category=clothes" },
          { title: "Formal", href: "/products/search?category=clothes" },
          { title: "Casual", href: "/products/search?category=clothes" }
        ]
      },
      {
        title: "Bags",
        href: "#",
        children: [
          { title: "Backpack", href: "/products/search?category=clothes" },
          { title: "Crossbody Bags", href: "/products/search?category=clothes" },
          { title: "Side Bags", href: "/products/search?category=clothes" },
          { title: "Slides", href: "/products/search?category=clothes" }
        ]
      }
    ]
  },
  {
    icon: "GiftLine",
    title: "Gifts",
    href: "/gifts",
    component: "List",
    children: [
      {
        icon: "LaptopMobile",
        title: "Electronics & Gadget",
        href: "/products/search?category=clothes"
      },

      {
        icon: "MicrophoneLines",
        title: "Music Instruments",
        href: "/products/search?category=clothes"
      },
      { icon: "ShirtLine", title: "Fashion", href: "/products/search?category=clothes" },
      { icon: "Trees", title: "Home & Garden", href: "/products/search?category=clothes" },
      { icon: "PersonBiking", title: "Bikes", href: "/products/search?category=clothes" },
      { icon: "GiftLine", title: "Gifts", href: "/products/search?category=clothes" },
      { icon: "MakeUp", title: "Beauty Care", href: "/products/search?category=clothes" },
      { icon: "PawSimple", title: "Dog Food", href: "/products/search?category=clothes" }
    ]
  },
  { icon: "MicrophoneLines", title: "Music", href: "/products/search?category=clothes" },
  { icon: "MakeUp", title: "Health & Beauty", href: "/products/search?category=clothes" },
  { icon: "PawSimple", title: "Pets", href: "/products/search?category=clothes" },
  { icon: "TeddyBearLight", title: "Baby Toys", href: "/products/search?category=clothes" },
  { icon: "BasketShopping", title: "Groceries", href: "/products/search?category=clothes" },
  { icon: "TireRuggedLight", title: "Automotive", href: "/products/search?category=clothes" }
];

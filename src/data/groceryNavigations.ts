const groceryNavigations = [
  {
    icon: "Carrot",
    title: "Vegetables",
    href: "/products/search?category=clothes"
  },
  {
    icon: "Apple",
    title: "Fruits & Vegetables",
    href: "/products/search?category=clothes",
    child: [
      {
        title: "Fresh Frutes",
        href: "/products/search?category=clothes",
        child: [
          { title: "Pears, apples, quinces", href: "/products/search?category=clothes" },
          { title: "Peaches, plums, apricots", href: "/products/search?category=clothes" },
          { title: "Grapes", href: "/products/search?category=clothes" }
        ]
      },
      {
        title: "Fresh Vegetables",
        href: "/products/search?category=clothes",
        child: [
          { title: "Onion", href: "/products/search?category=clothes" },
          { title: "Potato", href: "/products/search?category=clothes" },
          { title: "Vegetable Pack", href: "/products/search?category=clothes" }
        ]
      }
    ]
  },
  {
    icon: "Milk",
    title: "Dariry & Eggs",
    href: "/products/search?category=clothes"
  },
  {
    icon: "Breakfast",
    title: "Breakfast",
    href: "/products/search?category=clothes"
  },
  {
    icon: "Yogurt",
    title: "Frozen",
    href: "/products/search?category=clothes"
  },
  {
    icon: "Honey",
    title: "Organic",
    href: "/products/search?category=clothes"
  },
  {
    icon: "Beer",
    title: "Canned Food",
    href: "/products/search?category=clothes"
  },
  {
    icon: "Snack",
    title: "Coffee & Snacks",
    href: "/products/search?category=clothes"
  },
  {
    icon: "Bottle",
    title: "Sauces & Jems",
    href: "/products/search?category=clothes"
  }
];

export default groceryNavigations;

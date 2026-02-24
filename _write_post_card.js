const fs = require("fs");
const dir = "D:/ZedProjects/kindercare_mobile/lib/features/posts/widgets";
fs.mkdirSync(dir, { recursive: true });

const content = [
  "import 'dart:async';",
  "",
  "import 'package:flutter/material.dart';",
  "import 'package:flutter/services.dart';",
  "import 'package:kindercare_mobile/core/theme/theme_extensions.dart';",
  "import 'package:kindercare_mobile/core/widgets/avatar_widget.dart';",
  "import 'package:kindercare_mobile/domain/entities/post.dart';",
  "import 'package:kindercare_mobile/features/posts/widgets/threads_action_button.dart';",
  "import 'package:kindercare_mobile/features/posts/widgets/threads_image_gallery.dart';",
].join("
");
fs.writeFileSync(dir + "/threads_post_card.dart", content);
console.log("Written");
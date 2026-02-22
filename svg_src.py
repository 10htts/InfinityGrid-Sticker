def import_svg(
    svg_file: str | Path | TextIO,
    *,
    flip_y: bool = True,
    align: Align | tuple[Align, Align] | None = Align.MIN,
    ignore_visibility: bool = False,
    label_by: Literal["id", "class", "inkscape:label"] | str = "id",
    is_inkscape_label: bool | None = None,  # TODO remove for `1.0` release
) -> ShapeList[Wire | Face]:
    """import_svg

    Args:
        svg_file (Union[str, Path, TextIO]): svg file
        flip_y (bool, optional): flip objects to compensate for svg orientation. Defaults to True.
        align (Align | tuple[Align, Align] | None, optional): alignment of the SVG's viewbox,
            if None, the viewbox's origin will be at `(0,0,0)`. Defaults to Align.MIN.
        ignore_visibility (bool, optional): Defaults to False.
        label_by (str, optional): XML attribute to use for imported shapes' `label` property.
            Defaults to "id".
            Use `inkscape:label` to read labels set from Inkscape's "Layers and Objects" panel.

    Raises:
        ValueError: unexpected shape type

    Returns:
        ShapeList[Union[Wire, Face]]: objects contained in svg
    """
    if is_inkscape_label is not None:  # TODO remove for `1.0` release
        msg = "`is_inkscape_label` parameter is deprecated"
        if is_inkscape_label:
            label_by = "inkscape:" + label_by
            msg += f", use `label_by={label_by!r}` instead"
        warnings.warn(msg, stacklevel=2)

    shapes = []
    label_by = re.sub(
        r"^inkscape:(.+)", r"{http://www.inkscape.org/namespaces/inkscape}\1", label_by
    )
    imported = import_svg_document(
        svg_file,
        flip_y=flip_y,
        ignore_visibility=ignore_visibility,
        metadata=ColorAndLabel.Label_by(label_by),
    )

    doc_xy = Vector(imported.viewbox.x, imported.viewbox.y)
    doc_wh = Vector(imported.viewbox.width, imported.viewbox.height)
    offset = to_align_offset(doc_xy, doc_xy + doc_wh, align)

    for face_or_wire, color_and_label in imported:
        if isinstance(face_or_wire, TopoDS_Wire):
            shape = Wire(face_or_wire)
        elif isinstance(face_or_wire, TopoDS_Face):
            shape = Face(face_or_wire)
        else:  # should not happen
            raise ValueError(f"unexpected shape type: {type(face_or_wire).__name__}")

        if offset.X != 0 or offset.Y != 0:  # avoid copying if we don't need to
            shape = shape.translate(offset)

        if shape.wrapped:
            shape.color = Color(*color_and_label.color_for(shape.wrapped))
        shape.label = color_and_label.label
        shapes.append(shape)

    return ShapeList(shapes)

